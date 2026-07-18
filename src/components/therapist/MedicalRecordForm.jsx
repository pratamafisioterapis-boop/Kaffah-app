import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save, History, CalendarDays } from 'lucide-react';
import { getTherapistPatients, createMedicalRecord, getMedicalRecords, updateMedicalRecord, getPatients, getPatientById } from '@/lib/api';
import SearchableSelect from '@/components/ui/searchable-select';
import SOAPHistoryModal from '@/components/therapist/SOAPHistoryModal';
import { isValidUUID } from '@/lib/utils';
import { validatePatientId, handleUndefinedPatientId } from '@/lib/validationHelpers';
import { format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { id } from 'date-fns/locale';

const MedicalRecordForm = ({ therapist }) => {
  const { patientId: paramPatientId } = useParams();
  const [searchParams] = useSearchParams();
  const dailyRecapId = searchParams.get('dailyRecapId');
  const recordId = searchParams.get('recordId');
  const dateParam = searchParams.get('date'); 
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [formData, setFormData] = useState({
    patient_id: (paramPatientId !== 'select' && isValidUUID(paramPatientId)) ? paramPatientId : '',
    daily_recap_id: null,
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
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

    // Isi form SOAP
    setFormData({
      patient_id: data.patient_id,
      daily_recap_id: data.daily_recap_id || null,
      subjective: data.subjective || '',
      objective: data.objective || '',
      assessment: data.assessment || '',
      plan: data.plan || '',
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
};

// 🔥 HANYA CREATE MODE
if (!recordId) {
  payload.daily_recap_id = dailyRecapId;
}

       if (dateParam && !recordId) {
          payload.created_at = `${dateParam}T12:00:00`;
       }

       let result;
       if (recordId && isValidUUID(recordId)) {
         result = await updateMedicalRecord(recordId, payload);
       } else {
         result = await createMedicalRecord(payload);
       }
       
       if (result.error) throw result.error;
       
       window.dispatchEvent(new CustomEvent('medical-record-updated', { 
         detail: { patientId: formData.patient_id } 
       }));

       toast({ title: "Berhasil", description: recordId ? "Rekam medis diperbarui." : "Rekam medis berhasil disimpan." });
       navigate(-1);
    } catch (err) {
       toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
       setLoading(false);
    }
  };

  const handleCopySOAP = (record) => {
    if (!record) return;
    setFormData(prev => ({
      ...prev,
      subjective: record.subjective || '',
      objective: record.objective || '',
      assessment: record.assessment || '',
      plan: record.plan || '',
    }));
    toast({
      title: "Data Disalin!",
      description: "Data SOAP dari riwayat sebelumnya berhasil disalin ke form ini.",
      className: "bg-blue-50 border-blue-200 text-blue-800"
    });
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

  if (initialLoading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>;

  const soapFields = [
    { key: 'subjective',  label: 'Subjective',  short: 'S', placeholder: 'Keluhan pasien, riwayat penyakit...', accent: 'border-l-blue-400',    badge: 'bg-blue-500',    labelColor: 'text-blue-700'   },
    { key: 'objective',   label: 'Objective',   short: 'O', placeholder: 'Hasil observasi, pemeriksaan fisik, vital signs...', accent: 'border-l-teal-400',    badge: 'bg-teal-500',    labelColor: 'text-teal-700'   },
    { key: 'assessment',  label: 'Assessment',  short: 'A', placeholder: 'Analisis, diagnosis fisioterapi...', accent: 'border-l-violet-400',  badge: 'bg-violet-500',  labelColor: 'text-violet-700' },
    { key: 'plan',        label: 'Plan',        short: 'P', placeholder: 'Rencana terapi, edukasi, home program...', accent: 'border-l-rose-400',    badge: 'bg-rose-500',    labelColor: 'text-rose-700'   },
  ];

  return (
    <div className={isPWA ? "space-y-0" : "max-w-3xl mx-auto space-y-5"}>

      {/* ── Header ── */}
      <div className={`flex items-center justify-between gap-3 ${isPWA ? 'px-4 py-3 bg-white border-b' : ''}`}>
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/therapist/records');
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
              <span className="flex items-center gap-1 text-blue-600 font-medium text-xs mt-0.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                {format(new Date(dateParam), 'dd MMMM yyyy', { locale: id })}
              </span>
            )}
          </div>
        </div>
        {formData.patient_id && isValidUUID(formData.patient_id) && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl text-xs"
            onClick={() => setIsHistoryOpen(true)}
          >
            <History className="w-3.5 h-3.5" />
            {isPWA ? 'Riwayat' : 'Lihat SOAP Sebelumnya'}
          </Button>
        )}
      </div>

      {/* ── Form ── */}
      <Card className={`border-slate-200 shadow-sm ${isPWA ? 'rounded-none border-x-0' : 'rounded-2xl'}`}>
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
            </div>

            {/* SOAP Fields */}
            <div className={isPWA ? 'divide-y divide-slate-100' : 'grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100'}>
              {soapFields.map((field) => (
                <div
                  key={field.key}
                  className={`bg-white border-l-4 ${field.accent} ${isPWA ? 'px-4 py-4' : 'px-6 py-5'}`}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={`w-6 h-6 rounded-lg ${field.badge} text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm`}>
                      {field.short}
                    </span>
                    <label className={`text-sm font-semibold ${field.labelColor}`}>{field.label}</label>
                  </div>
                  <Textarea
                    placeholder={field.placeholder}
                    className={`bg-slate-50/80 border-slate-200 resize-none rounded-xl focus:bg-white focus:border-slate-300 transition-colors ${
                      isPWA ? 'min-h-[100px] text-base' : 'min-h-[130px]'
                    }`}
                    value={formData[field.key]}
                    onChange={e => setFormData({...formData, [field.key]: e.target.value})}
                    required
                  />
                </div>
              ))}
            </div>
            {/* Submit */}
            <div className={`flex justify-end gap-3 bg-white border-t ${isPWA ? 'px-4 py-4' : 'px-6 py-5'}`}>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/therapist/records');
                }
              }}>Batal</Button>
              <Button type="submit" className={`bg-blue-600 hover:bg-blue-700 rounded-xl ${isPWA ? 'flex-1' : 'min-w-[140px]'}`} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Simpan Data</>}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>

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