import React, { useState, useEffect } from 'react';
import { User, AlertCircle } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';
import { getPhysiotherapists } from '@/lib/api';
import TherapistTimeOffForm from './TherapistTimeOffForm';
import TherapistTimeOffList from './TherapistTimeOffList';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TherapistTimeOffManager = () => {
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTherapists();
  }, []);

  const loadTherapists = async () => {
    try {
      const { data, error } = await getPhysiotherapists();
      if (error) throw error;
      if (data) setTherapists(data);
    } catch (err) {
      console.error("Failed to load therapists:", err);
      setError("Gagal memuat data terapis. Silakan muat ulang halaman.");
    }
  };

  const therapistOptions = therapists.map(t => ({
    value: t.id,
    label: t.name
  }));

  const handleSuccess = () => {
    // Triggers a refresh in the TherapistTimeOffList component
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Manajemen Cuti Terapis</h2>
            <p className="text-sm text-slate-500">Kelola izin dan hari libur fisioterapis</p>
         </div>
         <div className="w-full sm:w-[300px]">
            <SearchableSelect 
               options={therapistOptions}
               value={selectedTherapist?.id}
               onChange={(val) => setSelectedTherapist(therapists.find(t => t.id === val))}
               placeholder="Pilih Terapis..."
            />
         </div>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!selectedTherapist ? (
         <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
            <User className="w-16 h-16 mb-4 opacity-30" />
            <p className="font-medium">Silakan pilih terapis terlebih dahulu untuk melihat dan menambah cuti</p>
         </div>
      ) : (
         <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
               <TherapistTimeOffForm 
                  therapist={selectedTherapist} 
                  onSuccess={handleSuccess}
               />
            </div>
            <div className="lg:col-span-2">
               <TherapistTimeOffList 
                  therapist={selectedTherapist} 
                  refreshTrigger={refreshTrigger} 
               />
            </div>
         </div>
      )}
    </div>
  );
};

export default TherapistTimeOffManager;