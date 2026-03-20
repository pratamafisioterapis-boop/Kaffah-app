import React, { useState, useEffect } from 'react';
import TherapistMedicalRecords from '@/components/therapist/TherapistMedicalRecords';
import { getAllPhysiotherapists } from '@/lib/api';
import SearchableSelect from '@/components/ui/searchable-select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { User } from 'lucide-react';
import { isValidUUID } from '@/lib/utils';

const OwnerTherapistMedicalRecords = () => {
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTherapists = async () => {
      setLoading(true);
      const { data } = await getAllPhysiotherapists();
      if (data) {
        setTherapists(data);
        if (data.length > 0) setSelectedTherapist(data[0]);
      }
      setLoading(false);
    };
    fetchTherapists();
  }, []);

  const therapistOptions = therapists.map(t => ({ value: t.id, label: t.name }));

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">Evaluasi Pasien</h1>
       </div>
       
       <Card className="bg-slate-50 border-slate-200">
         <CardContent className="pt-6">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                 <User className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1">
                 <label className="text-sm font-medium text-slate-600 mb-1 block">Pilih Terapis untuk Melihat Evaluasi</label>
                 <SearchableSelect 
                    options={therapistOptions}
                    value={selectedTherapist?.id}
                    onChange={(val) => setSelectedTherapist(therapists.find(t => t.id === val))}
                    placeholder="Pilih Terapis..."
                    isLoading={loading}
                    className="bg-white max-w-md"
                 />
              </div>
           </div>
         </CardContent>
       </Card>

       {selectedTherapist && isValidUUID(selectedTherapist.id) ? (
          <TherapistMedicalRecords therapist={selectedTherapist} isOwnerView={true} />
       ) : (
          <div className="text-center py-12 text-slate-400">
             Silakan pilih terapis terlebih dahulu.
          </div>
       )}
    </div>
  );
};

export default OwnerTherapistMedicalRecords;