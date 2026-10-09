import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save, Copy, History, CalendarDays, Clock, Wand2, Stethoscope, Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { rankDiagnosisOptions } from '@/lib/diagnosisSearch';
import { getTherapistPatients, createMedicalRecord, getMedicalRecords, updateMedicalRecord, getPatients, getPatientById, getTherapistSoapLockStatus, getPatientOnsetInfo, getDiagnosisOptions, getDiagnosisSubjectiveTemplates, getSubjectiveVariables, getIcfTitles, getEducationForDiagnoses } from '@/lib/api';
import { generateIcfAssessment, analyzeIcf, icfCodesOf } from '@/lib/icfAssessment';
import { buildEducationText } from '@/lib/educationMerge';
import { formatOnsetDuration, classifyOnsetPhase, deriveOnsetFromSubjective, refreshOnsetInSubjective } from '@/lib/onsetHelpers';
import { KAFFAH_CLINIC_ID } from '@/lib/subjectiveTemplate';
import SearchableSelect from '@/components/ui/searchable-select';
import SubjectiveTemplateBuilder from '@/components/therapist/SubjectiveTemplateBuilder';
import ObjectiveProgressUpdate from '@/components/therapist/ObjectiveProgressUpdate';
import PlanChecklist from '@/components/therapist/PlanChecklist';
import LabRadiologyUpload from '@/components/therapist/LabRadiologyUpload';
import SOAPHistoryModal from '@/components/therapist/SOAPHistoryModal';
import { isValidUUID } from '@/lib/utils';
import { validatePatientId, handleUndefinedPatientId } from '@/lib/validationHelpers';
import { format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAssessmentMode } from '@/hooks/useAssessmentMode';
import { id } from 'date-fns/locale';

const MedicalRecordForm = ({ therapist, basePath = '/therapist/records', filledByAdmin = false }) => {
  const { patientId: paramPatientId } = useParams();
  const [searchParams] = useSearchParams();
  const dailyRecapId = searchParams.get('dailyRecapId');
  const recordId = searchParams.get('recordId');
  const dateParam = searchParams.get('date'); 
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userDetails, user: authUser } = useAuth();
  const { mode: assessmentMode } = useAssessmentMode();
  const isDiagnosisMode = assessmentMode === 'diagnosis';
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [latestRecord, setLatestRecord] = useState(null);
  const [onsetInfo, setOnsetInfo] = useState(null);
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [diagnosis, setDiagnosis] = useState([]);
  const [progressDialog, setProgressDialog] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(null); // 'subjective' | 'objective' | null
  const [templateCache, setTemplateCache] = useState({});
  const [templateVariables, setTemplateVariables] = useState({});
  // Assessment disusun otomatis (format ICF) begitu S & O terisi, selama belum diedit manual.
  const [assessmentAuto, setAssessmentAuto] = useState(true);
  // Edukasi pasien: disusun dari template semua diagnosa terpilih, selama belum diedit manual.
  const [educationAuto, setEducationAuto] = useState(true);
  const [eduEntries, setEduEntries] = useState({});
  const [homeExercises, setHomeExercises] = useState([]);
  const [formData, setFormData] = useState({
    patient_id: (paramPatientId !== 'select' && isValidUUID(paramPatientId)) ? paramPatientId : '',
    daily_recap_id: null,
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    plan_data: null,
    lab_radiology_data: null,
    education: '',
    record_type: 'DAILY_EVALUATION'
  });

  useEffect(() => {
    if (therapist?.id) {
       loadPatients();
       if (recordId && isValidUUID(recordId)) {
         loadExistingRecord(recordId);
       }
    }
  }, [therapist, recordId, paramPatientId]);

  useEffect(() => {
    // Strict check for patient ID from params
    if (paramPatientId && paramPatientId !== 'select') {
        const validation = validatePatientId(paramPatientId, 'MedicalRecordForm Param Check');
        if (validation.valid) {
            setFormData(prev => ({ ...prev, patient_id: paramPatientId }));
        } else {
            console.error("Invalid patientId param:", paramPatientId);
            // Optional: Redirect or show error, but better to just not set invalid ID
        }
    }
  }, [paramPatientId]);

  useEffect(() => {
    if (formData.patient_id && isValidUUID(formData.patient_id)) {
      const pid = formData.patient_id;
      let cancelled = false;
      getPatientOnsetInfo(pid).then(async ({ data }) => {
        if (cancelled) return;
        if (data?.complaint_onset_date) { setOnsetInfo(data); return; }
        // Onset belum pernah diisi di rekam medis lengkap: perkirakan dari SOAP sebelumnya
        // ("sejak 2 minggu yang lalu" pada tanggal catatan itu).
        const { data: records } = await getMedicalRecords({ patientId: pid, limit: 20 });
        if (cancelled) return;
        const sorted = [...(records || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        for (const r of sorted) {
          const onset = deriveOnsetFromSubjective(r.subjective, r.created_at);
          if (onset) { setOnsetInfo({ complaint_onset_date: onset, derived: true }); return; }
        }
        setOnsetInfo(null);
      });
      return () => { cancelled = true; };
    } else {
      setOnsetInfo(null);
      return undefined;
    }
  }, [formData.patient_id]);

  // Diagnosa disimpan di daily_recaps (satu sumber) sehingga otomatis tampil
  // di Daily Recaps admin/owner, dan sebaliknya yang diisi admin tampil di sini.
  const linkedRecapId = formData.daily_recap_id || dailyRecapId;

  useEffect(() => {
    getDiagnosisOptions().then(({ data }) => setDiagnosisOptions(data || []));
  }, []);

  useEffect(() => {
    if (!linkedRecapId || !isValidUUID(linkedRecapId)) return;
    supabase
      .from('daily_recaps')
      .select('diagnosis')
      .eq('id', linkedRecapId)
      .maybeSingle()
      .then(({ data }) => {
        let diag = data?.diagnosis || [];
        if (typeof diag === 'string') {
          try { diag = JSON.parse(diag); } catch { diag = [diag]; }
        }
        if (!Array.isArray(diag)) diag = diag ? [diag] : [];
        setDiagnosis(diag);
      });
  }, [linkedRecapId]);

  useEffect(() => {
    getSubjectiveVariables().then(({ data }) => {
      setTemplateVariables(Object.fromEntries((data || []).map((v) => [v.key, v])));
    });
  }, []);

  useEffect(() => {
    getSubjectiveVariables().then(({ data }) => {
      setTemplateVariables(Object.fromEntries((data || []).map((v) => [v.key, v])));
    });
  }, []);

  // Template Subjective untuk diagnosa terpilih (hanya yang belum pernah dimuat).
  useEffect(() => {
    const missing = diagnosis.filter((d) => isValidUUID(d) && !(d in templateCache));
    if (missing.length === 0) return;
    getDiagnosisSubjectiveTemplates(missing).then(({ data }) => {
      setTemplateCache((prev) => {
        const next = { ...prev };
        missing.forEach((id) => { next[id] = null; });
        (data || []).forEach((row) => { next[row.id] = { label: row.label, template: row.subjective_template, objective: row.objective_template }; });
        return next;
      });
    });
  }, [diagnosis, templateCache]);

  const subjectiveTemplates = diagnosis
    .map((d) => (templateCache[d]?.template ? { key: d, label: templateCache[d].label, template: templateCache[d].template } : null))
    .filter(Boolean);
  const objectiveTemplates = diagnosis
    .map((d) => (templateCache[d]?.objective ? { key: d, label: templateCache[d].label, template: templateCache[d].objective } : null))
    .filter(Boolean);

  const isKaffahClinic = (userDetails?.clinic_id || therapist?.clinic_id) === KAFFAH_CLINIC_ID;
  const templatesOf = (key) => (key === 'subjective' ? subjectiveTemplates : key === 'objective' ? objectiveTemplates : []);
  // Kaffah: S & O diisi lewat template (pilih variabel); ketikan bebas baru terbuka setelah terisi.
  const isTemplateLocked = (key) => isKaffahClinic && templatesOf(key).length > 0 && !formData[key].trim();

  const diagnosisLabels = useMemo(() => diagnosis
    .map((d) => {
      const opt = diagnosisOptions.find((o) => o.id === d || o.value === d);
      if (opt) return opt.label;
      return isValidUUID(d) ? null : d;
    })
    .filter(Boolean), [diagnosis, diagnosisOptions]);

  // Judul resmi kode ICF dimuat dari database sesuai kode yang terdeteksi.
  const [icfTitles, setIcfTitles] = useState({});

  useEffect(() => {
    if (!assessmentAuto) return undefined;
    if (isDiagnosisMode) {
      // Satu diagnosa ditulis langsung; lebih dari satu dipisah per baris tanpa nomor.
      const text = diagnosisLabels.join('\n');
      setFormData((prev) => (prev.assessment === text ? prev : { ...prev, assessment: text }));
      return undefined;
    }
    const timer = setTimeout(() => {
      const input = { subjective: formData.subjective, objective: formData.objective, diagnoses: diagnosisLabels };
      const missing = icfCodesOf(analyzeIcf(input)).filter((c) => !(c in icfTitles));
      if (missing.length) {
        getIcfTitles(missing).then(({ data }) => setIcfTitles((prev) => ({ ...prev, ...Object.fromEntries(missing.map((c) => [c, null])), ...data })));
      }
      const text = generateIcfAssessment({ ...input, titles: icfTitles });
      setFormData((prev) => (prev.assessment === text ? prev : { ...prev, assessment: text }));
    }, 500);
    return () => clearTimeout(timer);
  }, [assessmentAuto, isDiagnosisMode, formData.subjective, formData.objective, diagnosisLabels, icfTitles]);

  useEffect(() => {
    const keys = diagnosisLabels.map((l) => String(l).trim().toLowerCase());
    const missing = [...new Set(keys.filter((k) => !(k in eduEntries)))];
    if (missing.length === 0) return;
    getEducationForDiagnoses(missing).then(({ data }) => {
      setEduEntries((prev) => ({ ...prev, ...Object.fromEntries(missing.map((k) => [k, null])), ...data }));
    });
  }, [diagnosisLabels, eduEntries]);

  useEffect(() => {
    if (!educationAuto) return;
    const entries = diagnosisLabels.map((l) => eduEntries[String(l).trim().toLowerCase()]).filter(Boolean);
    const text = buildEducationText(entries, homeExercises);
    setFormData((prev) => (prev.education === text ? prev : { ...prev, education: text }));
  }, [educationAuto, diagnosisLabels, eduEntries, homeExercises]);

  const canAutoAssess = isDiagnosisMode ? diagnosisLabels.length > 0 : !!(formData.subjective.trim() && formData.objective.trim());

  const regenerateAssessment = () => {
    setAssessmentAuto(true);
    toast({
      title: isDiagnosisMode ? 'Assessment diisi ulang' : 'Assessment ICF disusun ulang',
      description: isDiagnosisMode ? 'Dibuat dari diagnosa terpilih. Silakan cek dan sesuaikan.' : 'Dibuat dari Subjective & Objective terbaru. Silakan cek dan sesuaikan.',
      className: 'bg-blue-50 border-blue-200 text-blue-800',
    });
  };

  const handleApplyTemplate = (field) => (text, { replace }) => {
    setFormData((prev) => {
      const existing = (prev[field] || '').trim();
      return { ...prev, [field]: replace || !existing ? text : `${existing}\n\n${text}` };
    });
    toast({
      title: replace ? `${field === 'objective' ? 'Objective' : 'Subjective'} terisi` : 'Template ditambahkan',
      description: 'Silakan cek dan lengkapi bila perlu.',
      className: 'bg-blue-50 border-blue-200 text-blue-800',
    });
  };

  const loadExistingRecord = async (id) => {
  setInitialLoading(true);
  try {
    const { data, error } = await supabase
      .from('medical_records')
      .select(`
        *,
        patient:patients (
          id,
          full_name,
          medical_record_number
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Assessment yang sudah ada dianggap hasil edit terapis: jangan ditimpa otomatis.
    setAssessmentAuto(!(data.assessment || '').trim());
    setEducationAuto(!(data.education || '').trim());

    // Isi form SOAP
    setFormData({
      patient_id: data.patient_id,
      daily_recap_id: data.daily_recap_id || null,
      subjective: data.subjective || '',
      objective: data.objective || '',
      assessment: data.assessment || '',
      plan: data.plan || '',
      // Record lama (teks saja) tampil sebagai catatan tambahan di checklist.
      plan_data: data.plan_data || (data.plan ? { notes: data.plan } : null),
      education: data.education || '',
      lab_radiology_data: data.lab_radiology_data || null,
      record_type: data.record_type || 'SOAP'
    });

    // Pastikan dropdown memiliki data pasien yang sedang diedit
    if (data.patient) {
      setPatients(prev => {
        const exists = prev.some(p => p.id === data.patient.id);
        if (exists) return prev;
        return [
          {
            id: data.patient.id,
            value: data.patient.id,
            label: data.patient.full_name,
            full_name: data.patient.full_name,
            medical_record_number: data.patient.medical_record_number,
            phone: data.patient.phone || ''
          },
          ...prev
        ];
      });
    }

  } catch (err) {
    console.error("Failed to load existing record:", err);

    toast({
      variant: "destructive",
      title: "Error",
      description: "Gagal memuat data record."
    });

  } finally {
    setInitialLoading(false);
  }
};
  const loadPatients = async () => {
    try {
        let data = [];
        if (paramPatientId && paramPatientId !== 'select' && isValidUUID(paramPatientId)) {
           const { data: allPatients } = await getPatients();
           data = allPatients || [];

           // getPatients() hanya mengembalikan 50 pasien aktif teratas (alfabetis),
           // jadi pasien yang sedang dibuatkan catatan bisa saja tidak ikut ter-load
           // (muncul sebagai UUID mentah di dropdown). Pastikan dia selalu ada di daftar.
           if (!data.some(p => p.id === paramPatientId)) {
             const { data: targetPatient } = await getPatientById(paramPatientId);
             if (targetPatient) {
               data = [
                 {
                   id: targetPatient.id,
                   value: targetPatient.id,
                   label: targetPatient.full_name,
                   full_name: targetPatient.full_name,
                   medical_record_number: targetPatient.medical_record_number,
                   phone: targetPatient.phone || ''
                 },
                 ...data
               ];
             }
           }
        } else {
           const { data: assigned } = await getTherapistPatients(therapist.id);
           data = assigned || [];
        }
        setPatients(data || []);
    } catch (err) {
        console.error("Failed to load patients:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Strict Validation before submit
    if (handleUndefinedPatientId(formData.patient_id, 'FormSubmit')) {
        return;
    }
    
    if (linkedRecapId && isValidUUID(linkedRecapId) && diagnosis.length === 0) {
      toast({ variant: "destructive", title: "Diagnosa wajib diisi", description: "Pilih minimal satu diagnosa." });
      return;
    }

    if (!formData.plan.trim()) {
      toast({ variant: "destructive", title: "Plan belum diisi", description: "Centang minimal satu tindakan atau tulis catatan Plan." });
      return;
    }

    setLoading(true);
    try {
       const cleanData = { ...formData };

       const payload = {
  ...cleanData,
  subjective: cleanData.subjective || '',
  objective: cleanData.objective || '',
  assessment: cleanData.assessment || '',
  plan: cleanData.plan || '',
  created_by: therapist.user_id,
  ...(filledByAdmin ? { filled_by_admin_id: authUser?.id } : {}),
};

// 🔥 HANYA CREATE MODE
const isCreate = !recordId;
if (isCreate) {
  payload.daily_recap_id = dailyRecapId;
}

       if (dateParam && !recordId) {
          payload.created_at = `${dateParam}T12:00:00`;
       }

       // Ambil status kunci SEBELUM simpan, supaya bisa dibandingkan setelah
       // simpan untuk mendeteksi SOAP yang jadi ambang pembuka jadwal.
       let wasLocked = false;
       if (isCreate && therapist?.id) {
         const { data: lockStatus } = await getTherapistSoapLockStatus(therapist.id);
         wasLocked = !!lockStatus?.locked;
       }

       if (!isCreate && !payload.daily_recap_id) delete payload.daily_recap_id;

       let result;
       if (recordId && isValidUUID(recordId)) {
         result = await updateMedicalRecord(recordId, payload);
       } else {
         result = await createMedicalRecord(payload);
       }

       if (result.error) throw result.error;

       // Tautkan diagnosa ke daily recap (terlihat oleh admin & owner)
       if (linkedRecapId && isValidUUID(linkedRecapId)) {
         const { error: diagError } = await supabase
           .from('daily_recaps')
           .update({ diagnosis, updated_at: new Date().toISOString() })
           .eq('id', linkedRecapId);
         if (diagError) {
           toast({ variant: "destructive", title: "SOAP tersimpan, diagnosa gagal", description: diagError.message });
         }
       }

       window.dispatchEvent(new CustomEvent('medical-record-updated', {
         detail: { patientId: formData.patient_id }
       }));

       toast({ title: "Berhasil", description: recordId ? "Rekam medis diperbarui." : "Rekam medis berhasil disimpan." });

       // SOAP ini yang membuat jumlah SOAP belum diisi turun di bawah ambang
       // batas -> jadwal baru saja terbuka kembali. Beri tahu terapis
       // langsung supaya tidak menunda-nunda mengisi SOAP yang tersisa.
       if (isCreate && wasLocked && therapist?.id) {
         const { data: lockStatusAfter } = await getTherapistSoapLockStatus(therapist.id);
         if (!lockStatusAfter?.locked) {
           toast({
             title: "🔓 Jadwal Anda Telah Dibuka!",
             description: "Kerja bagus! SOAP ini melengkapi kekurangan Anda dan jadwal booking Anda kini terbuka kembali. Yuk langsung lengkapi SOAP lain yang masih tersisa, jangan ditunda-tunda.",
             className: "bg-green-50 border-green-200 text-green-800",
             duration: 8000,
           });
         }
       }

       navigate(-1);
    } catch (err) {
       toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
       setLoading(false);
    }
  };

  // Kunjungan sebelumnya (terbaru) untuk pasien ini; tombol Riwayat/Salin hanya muncul bila ada.
  useEffect(() => {
    let cancelled = false;
    setLatestRecord(null);
    if (!formData.patient_id || !isValidUUID(formData.patient_id)) return;
    (async () => {
      try {
        const { data } = await getMedicalRecords({ patientId: formData.patient_id });
        if (cancelled || !data) return;
        const prev = data
          .filter(r => r.id !== recordId)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        setLatestRecord(prev || null);
      } catch (err) {
        console.error('Error fetching previous SOAP', err);
      }
    })();
    return () => { cancelled = true; };
  }, [formData.patient_id, recordId]);

  const handleCopySOAP = (record) => {
    if (!record) return;
    setAssessmentAuto(false);
    setFormData(prev => ({
      ...prev,
      subjective: refreshOnsetInSubjective(
        record.subjective || '',
        onsetInfo?.complaint_onset_date || deriveOnsetFromSubjective(record.subjective, record.created_at)
      ),
      objective: record.objective || '',
      assessment: record.assessment || '',
      plan: record.plan || '',
      plan_data: record.plan_data || (record.plan ? { notes: record.plan } : null),
    }));
    toast({
      title: "Data Disalin!",
      description: "Data SOAP berhasil disalin; durasi onset di Subjective sudah disesuaikan sampai hari ini.",
      className: "bg-blue-50 border-blue-200 text-blue-800"
    });
    // Terapi lanjutan: langsung tawarkan update kondisi klinis lewat klik.
    if ((record.objective || '').trim()) setProgressDialog(true);
  };

  const patientOptions = patients.map(p => ({
    value: p.id,
    label: p.full_name
  }));
  const isPWA = (() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    } catch { return false; }
  })();

  if (initialLoading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-app-accent" /></div>;

  const soapFields = [
    { key: 'subjective',  label: 'Subjective',  short: 'S', placeholder: 'Keluhan pasien, riwayat penyakit...', accent: 'border-l-app-accent-bright',    badge: 'bg-app-accent-bright',    labelColor: 'text-app-accent-hover'   },
    { key: 'objective',   label: 'Objective',   short: 'O', placeholder: 'Hasil observasi, pemeriksaan fisik, vital signs...', accent: 'border-l-teal-400',    badge: 'bg-teal-500',    labelColor: 'text-teal-700'   },
    { key: 'assessment',  label: 'Assessment',  short: 'A', placeholder: isDiagnosisMode ? 'Terisi otomatis dari diagnosa yang dipilih...' : 'Terisi otomatis (format ICF) setelah Subjective & Objective diisi...', accent: 'border-l-violet-400',  badge: 'bg-violet-500',  labelColor: 'text-violet-700' },
    { key: 'plan',        label: 'Plan',        short: 'P', placeholder: 'Rencana terapi, edukasi, home program...', accent: 'border-l-rose-400',    badge: 'bg-rose-500',    labelColor: 'text-rose-700'   },
  ];

  return (
    <div className={isPWA ? "space-y-0" : "max-w-3xl mx-auto space-y-5"}>

      {/* ── Header ── */}
      <div className={`flex items-center justify-between gap-3 ${isPWA ? 'px-4 py-3 bg-white border-b' : ''}`}>
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-app" onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate(basePath);
            }
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className={`font-bold text-slate-900 ${isPWA ? 'text-base' : 'text-xl truncate'}`}>
              {isPWA
                ? (recordId ? 'Edit Catatan' : 'Buat Catatan SOAP')
                : (recordId ? 'Edit Catatan Medis' : 'Buat Catatan Medis (SOAP)')}
            </h2>
            {dateParam && (
              <span className="flex items-center gap-1 text-app-accent font-medium text-xs mt-0.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                {format(new Date(dateParam), 'dd MMMM yyyy', { locale: id })}
              </span>
            )}
          </div>
        </div>
        {formData.patient_id && isValidUUID(formData.patient_id) && latestRecord && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-app text-xs"
              onClick={() => handleCopySOAP(latestRecord)}
            >
              <Copy className="w-3.5 h-3.5" />
              {isPWA ? 'Salin' : 'Salin SOAP Terakhir'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-app text-xs"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History className="w-3.5 h-3.5" />
              {isPWA ? 'Riwayat' : 'Lihat SOAP Sebelumnya'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Form ── */}
      <Card className={`border-slate-200 shadow-sm ${isPWA ? 'rounded-none border-x-0' : 'rounded-app-lg'}`}>
        <CardContent className="p-0">
          <form onSubmit={handleSubmit}>
            {/* Nama Pasien */}
            <div className={`${isPWA ? 'px-4 py-4' : 'px-6 py-5'} border-b bg-white`}>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Nama Pasien</label>
              <SearchableSelect
                options={patientOptions}
                value={formData.patient_id}
                onChange={(val) => setFormData({...formData, patient_id: val})}
                disabled={true}
                placeholder="Cari Pasien..."
              />
              {paramPatientId !== 'select' && !patients.find(p => p.id === paramPatientId) && (
                <p className="text-xs text-amber-600 mt-1">Memuat data pasien terpilih...</p>
              )}
              {onsetInfo?.complaint_onset_date && (() => {
                const duration = formatOnsetDuration(onsetInfo.complaint_onset_date);
                const phase = classifyOnsetPhase(onsetInfo.complaint_onset_date);
                const phaseStyles = {
                  amber: 'bg-amber-50 border-amber-200 text-amber-800',
                  blue: 'bg-blue-50 border-blue-200 text-blue-800',
                  rose: 'bg-rose-50 border-rose-200 text-rose-800',
                };
                return (
                  <div className={`mt-3 flex items-start gap-2 rounded-app border px-3 py-2.5 ${phaseStyles[phase?.color] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs leading-relaxed">
                      <span className="font-semibold">Pengingat:</span> pasien sudah <strong>{duration}</strong> mengalami keluhan ini
                      {phase && <> (<strong>{phase.label}</strong>)</>}, sejak {format(new Date(`${onsetInfo.complaint_onset_date}T00:00:00`), 'dd MMMM yyyy', { locale: id })}{onsetInfo.derived && <> (perkiraan dari SOAP sebelumnya)</>}.
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Diagnosa */}
            <div className={`${isPWA ? 'px-4 py-4' : 'px-6 py-5'} border-b bg-white`}>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Diagnosa <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={diagnosisOptions}
                value={diagnosis}
                onChange={setDiagnosis}
                rankOptions={rankDiagnosisOptions}
                multiple={true}
                allowCreate={false}
                notFoundText="Diagnosa tidak ditemukan. Hubungi owner untuk menambahkan."
                placeholder="Pilih diagnosa..."
              />
              <p className="text-xs text-slate-500 mt-1">Otomatis tertaut ke Daily Recap admin & owner.</p>
            </div>

            {/* SOAP Fields */}
            <div className={isPWA ? 'divide-y divide-slate-100' : 'grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100'}>
              {soapFields.map((field) => (
                <div
                  key={field.key}
                  className={`bg-white border-l ${field.accent} ${isPWA ? 'px-4 py-4' : 'px-6 py-5'} ${field.key === 'plan' ? 'md:col-span-2' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={`w-6 h-6 rounded-app-sm ${field.badge} text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`}>
                      {field.short}
                    </span>
                    <label className={`text-sm font-semibold ${field.labelColor}`}>{field.label}</label>
                    {field.key === 'assessment' && (
                      <span className="ml-auto flex items-center gap-1.5">
                        {assessmentAuto ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            <Sparkles className="h-3 w-3" /> {isDiagnosisMode ? 'Otomatis Diagnosis' : 'Otomatis ICF'}
                          </span>
                        ) : canAutoAssess && (
                          <button
                            type="button"
                            onClick={regenerateAssessment}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                          >
                            <RefreshCw className="h-3 w-3" /> {isDiagnosisMode ? 'Isi ulang dari diagnosa' : 'Susun ulang dari S & O'}
                          </button>
                        )}
                      </span>
                    )}
                    {field.key === 'objective' && formData.objective.trim() && (
                      <button
                        type="button"
                        onClick={() => setProgressDialog(true)}
                        className="ml-auto inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                      >
                        <TrendingUp className="h-3.5 w-3.5" /> Update kondisi
                      </button>
                    )}
                    {(field.key === 'subjective' ? subjectiveTemplates : field.key === 'objective' ? objectiveTemplates : []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTemplateDialog(field.key)}
                        title={`Template ${field.label}`}
                        aria-label={`Buka template ${field.label}`}
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-app bg-app-accent text-white shadow-sm hover:bg-app-accent-hover"
                      >
                        {field.key === 'objective' ? <Stethoscope className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {field.key === 'plan' ? (
                    <PlanChecklist
                      diagnosisLabels={diagnosisLabels}
                      value={formData.plan_data}
                      onChange={(plan_data, plan, names) => {
                        setFormData((prev) => ({ ...prev, plan_data, plan }));
                        setHomeExercises(names || []);
                      }}
                    />
                  ) : (
                  <>
                  {isKaffahClinic && (field.key === 'subjective' || field.key === 'objective') && templatesOf(field.key).length > 0 && (
                    <div className="mb-3 overflow-hidden rounded-app-lg border border-app-accent/15 bg-app-soft/30 p-3">
                      <SubjectiveTemplateBuilder
                        embedded
                        templates={templatesOf(field.key)}
                        variables={templateVariables}
                        currentText={formData[field.key]}
                        onApply={handleApplyTemplate(field.key)}
                        mode={field.key}
                      />
                    </div>
                  )}
                  <Textarea
                    readOnly={isTemplateLocked(field.key)}
                    placeholder={isTemplateLocked(field.key) ? `Pilih & isi template di atas, lalu klik "Masukkan ke ${field.label}". Setelah itu teks bisa diedit.` : field.placeholder}
                    className={`bg-slate-50/80 border-slate-200 resize-none rounded-app focus:bg-white focus:border-slate-300 transition-colors ${
                      field.key === 'assessment'
                        ? (isPWA ? 'min-h-[260px] text-base' : 'min-h-[300px]')
                        : (isPWA ? 'min-h-[100px] text-base' : 'min-h-[130px]')
                    }`}
                    value={formData[field.key]}
                    onChange={e => {
                      if (field.key === 'assessment') setAssessmentAuto(false);
                      setFormData({...formData, [field.key]: e.target.value});
                    }}
                    required
                  />
                  </>
                  )}
                </div>
              ))}
            </div>

            {/* Laboratory & Radiology */}
            <div className={`bg-white border-t ${isPWA ? 'px-4 py-4' : 'px-6 py-5'}`}>
              <label className="mb-3 block text-sm font-semibold text-slate-700">Laboratory &amp; Radiology</label>
              <LabRadiologyUpload
                clinicId={userDetails?.clinic_id || therapist?.clinic_id}
                value={formData.lab_radiology_data}
                onChange={(lab_radiology_data) => setFormData((prev) => ({ ...prev, lab_radiology_data }))}
              />
            </div>

            {/* Edukasi Pasien */}
            <div className={`bg-white border-t border-l border-l-emerald-400 ${isPWA ? 'px-4 py-4' : 'px-6 py-5'}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-6 h-6 rounded-app-sm bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">E</span>
                <label className="text-sm font-semibold text-emerald-700">Edukasi Pasien</label>
                <span className="ml-auto flex items-center gap-1.5">
                  {educationAuto ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <Sparkles className="h-3 w-3" /> Dari template diagnosa
                    </span>
                  ) : diagnosisLabels.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEducationAuto(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <RefreshCw className="h-3 w-3" /> Susun ulang dari diagnosa
                    </button>
                  )}
                </span>
              </div>
              <Textarea
                placeholder="Terisi otomatis dari template edukasi setelah diagnosa dipilih. Bisa diedit."
                className={`bg-slate-50/80 border-slate-200 resize-none rounded-app focus:bg-white focus:border-slate-300 transition-colors ${isPWA ? 'min-h-[260px] text-base' : 'min-h-[300px]'}`}
                value={formData.education}
                onChange={(e) => {
                  setEducationAuto(false);
                  setFormData({ ...formData, education: e.target.value });
                }}
              />
            </div>

            {/* Submit */}
            <div className={`flex justify-end gap-3 bg-white border-t ${isPWA ? 'px-4 py-4' : 'px-6 py-5'}`}>
              <Button type="button" variant="outline" className="rounded-app" onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(basePath);
                }
              }}>Batal</Button>
              <Button type="submit" className={`bg-app-accent hover:bg-app-accent-hover rounded-app ${isPWA ? 'flex-1' : 'min-w-[140px]'}`} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Simpan Data</>}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>

      {['subjective', 'objective'].map((key) => {
        const tpls = key === 'subjective' ? subjectiveTemplates : objectiveTemplates;
        return (
          <Dialog key={key} open={templateDialog === key} onOpenChange={(o) => !o && setTemplateDialog(null)}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Isi {key === 'objective' ? 'Objective' : 'Subjective'} Cepat</DialogTitle>
                <DialogDescription>Klik pilihan & isi titik-titik, bagian kosong tidak ikut tampil</DialogDescription>
              </DialogHeader>
              {tpls.length > 0 && (
                <SubjectiveTemplateBuilder
                  embedded
                  templates={tpls}
                  variables={templateVariables}
                  currentText={formData[key]}
                  onApply={(text, opts) => { handleApplyTemplate(key)(text, opts); setTemplateDialog(null); }}
                  mode={key}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })}

      <Dialog open={progressDialog} onOpenChange={setProgressDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Kondisi Klinis</DialogTitle>
            <DialogDescription>Cukup klik perubahan dibanding terapi sebelumnya</DialogDescription>
          </DialogHeader>
          <ObjectiveProgressUpdate
            currentText={formData.objective}
            onApply={(text) => {
              setFormData((prev) => ({ ...prev, objective: text }));
              setProgressDialog(false);
              toast({ title: 'Kondisi diperbarui', description: 'Baris "Update Kondisi" ditambahkan ke Objective.', className: 'bg-blue-50 border-blue-200 text-blue-800' });
            }}
          />
        </DialogContent>
      </Dialog>

      <SOAPHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        patientId={formData.patient_id}
        onCopy={handleCopySOAP}
      />
    </div>
  );
};

export default MedicalRecordForm;