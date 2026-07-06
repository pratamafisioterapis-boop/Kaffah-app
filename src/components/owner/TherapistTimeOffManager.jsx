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

  const getInitials = (name) => {
    if (!name) return 'TH';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleSuccess = () => {
    // Triggers a refresh in the TherapistTimeOffList component
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <h2 className="text-xl font-bold text-slate-800">Manajemen Cuti Terapis</h2>
         <p className="text-sm text-slate-500">Kelola izin dan hari libur fisioterapis</p>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Cards Terapis - pilih langsung tanpa dropdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {therapists.map((t) => {
          const isActive = selectedTherapist?.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTherapist(t)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center ${
                isActive
                  ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {getInitials(t.name)}
              </div>
              <span className="text-sm font-medium text-slate-700 truncate w-full">{t.name}</span>
            </button>
          );
        })}
      </div>

      {!selectedTherapist ? (
         <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
            <User className="w-16 h-16 mb-4 opacity-30" />
            <p className="font-medium">Silakan pilih salah satu card terapis di atas untuk melihat dan menambah cuti</p>
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