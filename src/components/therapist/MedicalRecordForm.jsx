import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save, History, CalendarDays } from 'lucide-react';
import { getTherapistPatients, createMedicalRecord, getMedicalRecords, updateMedicalRecord, getPatients } from '@/lib/api';
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
            label: `${data.patient.full_name} (${data.patient.medical_record_number || '-'})`,
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
  label: `${p.full_name} (${p.medical_record_number || '-'})`
}));

  if (initialLoading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
             <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
             <h2 className="text-2xl font-bold text-slate-900">
               {recordId ? 'Edit Catatan Medis' : 'Buat Catatan Medis (SOAP)'}
             </h2>
             <p className="text-slate-500 text-sm">
                {dateParam ? (
                    <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                        <CalendarDays className="w-4 h-4" /> 
                        Untuk Tanggal: {format(new Date(dateParam), 'dd MMMM yyyy', { locale: id })}
                    </span>
                ) : "Catat perkembangan kesehatan pasien."}
             </p>
          </div>
        </div>

        {formData.patient_id && isValidUUID(formData.patient_id) && (
          <Button 
            variant="outline" 
            className="gap-2 bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={() => setIsHistoryOpen(true)}
          >
            <History className="w-4 h-4" />
            Lihat SOAP Sebelumnya
          </Button>
        )}
      </div>

      <Card>
         <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Pasien</label>
                  <SearchableSelect 
                    options={patientOptions}
                    value={formData.patient_id}
                    onChange={(val) => setFormData({...formData, patient_id: val})}
                    disabled={paramPatientId !== 'select' || !!recordId}
                    placeholder="Cari Pasien..."
                  />
                  {paramPatientId !== 'select' && !patients.find(p => p.id === paramPatientId) && (
                    <p className="text-xs text-amber-600 mt-1">Memuat data pasien terpilih...</p>
                  )}
               </div>

               <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-slate-700">Subjective (S)</label>
                     </div>
                     <Textarea 
                       placeholder="Keluhan pasien, riwayat penyakit..." 
                       className="min-h-[140px] focus:ring-blue-200"
                       value={formData.subjective}
                       onChange={e => setFormData({...formData, subjective: e.target.value})}
                       required
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-700">Objective (O)</label>
                     <Textarea 
                       placeholder="Hasil observasi, pemeriksaan fisik, vital signs..." 
                       className="min-h-[140px] focus:ring-blue-200"
                       value={formData.objective}
                       onChange={e => setFormData({...formData, objective: e.target.value})}
                       required
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-700">Assessment (A)</label>
                     <Textarea 
                       placeholder="Analisis, diagnosis fisioterapi..." 
                       className="min-h-[140px] focus:ring-blue-200"
                       value={formData.assessment}
                       onChange={e => setFormData({...formData, assessment: e.target.value})}
                       required
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-700">Plan (P)</label>
                     <Textarea 
                       placeholder="Rencana terapi, edukasi, home program..." 
                       className="min-h-[140px] focus:ring-blue-200"
                       value={formData.plan}
                       onChange={e => setFormData({...formData, plan: e.target.value})}
                       required
                     />
                  </div>
               </div>

               <div className="pt-4 flex justify-end gap-3 border-t">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>Batal</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 min-w-[140px]" disabled={loading}>
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