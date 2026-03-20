import React, { useState, useEffect } from 'react';
import { Loader2, Search, User, FileText, Phone, MapPin, PlusCircle, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTherapistPatientsFromRecaps } from '@/lib/therapistDataUtils';
import { normalizePatient } from '@/lib/patientHelpers';
import { useNavigate } from 'react-router-dom';

const TherapistPatients = ({ therapist }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (therapist?.name) {
      loadPatients();
    }
  }, [therapist]);

  const loadPatients = async () => {
    setLoading(true);
    const { data } = await getTherapistPatientsFromRecaps(therapist.name);
    // Normalize data immediately
    const normalizedData = (data || []).map(p => normalizePatient(p));
    setPatients(normalizedData);
    setLoading(false);
  };

  const filtered = patients.filter(p => 
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
    (p.medical_record_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateRecord = (patientId) => {
    navigate(`/therapist/records/new/${patientId}`);
  };

  const handleViewRecords = (patientId) => {
    navigate(`/therapist/records?patientId=${patientId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pasien Saya</h2>
          <p className="text-slate-500">
            {loading ? 'Memuat data pasien...' : `Daftar ${patients.length} pasien yang pernah Anda tangani.`}
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input 
            placeholder="Cari nama atau No. RM..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
           <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-slate-500 font-medium">Belum ada pasien yang ditemukan.</p>
           <p className="text-xs text-slate-400">Pasien akan muncul di sini setelah Anda memiliki riwayat pelayanan (Recap) dengan mereka.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(patient => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow group flex flex-col h-full border-slate-200">
              <CardHeader className="pb-3 relative">
                 <div className="absolute right-4 top-4">
                    {patient.isComplete ? (
                        <div title="Data Lengkap">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                        </div>
                    ) : (
                        <div title="Data Tidak Lengkap">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                        </div>
                    )}
                 </div>
                 <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                          {patient.full_name ? patient.full_name.charAt(0).toUpperCase() : '?'}
                       </div>
                       <div>
                          <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">{patient.full_name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {patient.medical_record_number || 'No RM'}
                             </span>
                             <span className="text-xs text-slate-400">•</span>
                             <span className="text-xs text-slate-600">{patient.formattedAge}</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </CardHeader>
              
              <CardContent className="space-y-3 text-sm flex-1">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                         <Phone className="w-3.5 h-3.5 text-slate-400" /> 
                         <span>{patient.formattedPhone}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-slate-600">
                         <Calendar className="w-3.5 h-3.5 text-slate-400" /> 
                         <span>Lahir: {patient.formattedBirthDate}</span>
                    </div>

                    {patient.address && (
                      <div className="flex items-start gap-2 text-slate-600">
                         <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" /> 
                         <span className="line-clamp-2">{patient.address}</span>
                      </div>
                    )}
                    
                    <div className="pt-1">
                       <Badge variant="outline" className="font-normal text-xs capitalize">
                          {patient.genderLabel}
                       </Badge>
                    </div>
                 </div>
              </CardContent>

              <CardFooter className="pt-2 flex gap-2 border-t bg-slate-50/50 p-4">
                 <Button 
                   className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border shadow-sm h-9 text-xs" 
                   size="sm"
                   onClick={() => handleViewRecords(patient.id)}
                 >
                    <FileText className="w-3.5 h-3.5 mr-2" /> Lihat Rekam Medis
                 </Button>
                 <Button 
                   className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs" 
                   size="sm"
                   onClick={() => handleCreateRecord(patient.id)}
                 >
                    <PlusCircle className="w-3.5 h-3.5 mr-2" /> Catat Medis
                 </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TherapistPatients;