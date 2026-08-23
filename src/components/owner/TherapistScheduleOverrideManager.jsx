import React, { useState, useEffect } from 'react';
import { User, AlertCircle } from 'lucide-react';
import { getPhysiotherapists } from '@/lib/api';
import TherapistScheduleOverrideForm from './TherapistScheduleOverrideForm';
import TherapistScheduleOverrideList from './TherapistScheduleOverrideList';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TherapistPickerGrid from './TherapistPickerGrid';

const TherapistScheduleOverrideManager = () => {
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
      console.error('Failed to load therapists:', err);
      setError('Gagal memuat data terapis. Silakan muat ulang halaman.');
    }
  };

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">Jadwal Pengganti (Per Tanggal)</h2>
        <p className="text-sm text-slate-500">
          Untuk perubahan jam kerja sementara di tanggal tertentu (mis. tukar shift) — tidak mengubah jadwal mingguan tetap.
          Dipakai otomatis oleh fitur Absensi Karyawan untuk menentukan jam masuk yang seharusnya pada tanggal itu.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <TherapistPickerGrid
        therapists={therapists}
        selectedId={selectedTherapist?.id}
        onSelect={setSelectedTherapist}
      />

      {!selectedTherapist ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
          <User className="w-16 h-16 mb-4 opacity-30" />
          <p className="font-medium">Silakan pilih salah satu card terapis di atas untuk melihat dan menambah jadwal pengganti</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <TherapistScheduleOverrideForm therapist={selectedTherapist} onSuccess={handleSuccess} />
          </div>
          <div className="lg:col-span-2">
            <TherapistScheduleOverrideList therapist={selectedTherapist} refreshTrigger={refreshTrigger} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TherapistScheduleOverrideManager;
