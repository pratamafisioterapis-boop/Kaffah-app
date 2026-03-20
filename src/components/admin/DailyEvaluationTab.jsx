import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Calendar, ChevronRight, Search, ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import DailyEvaluationDetailModal from './DailyEvaluationDetailModal';

const DailyEvaluationTab = () => {
  const [loading, setLoading] = useState(true);
  const [patientGroups, setPatientGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientGroup, setSelectedPatientGroup] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchSoapRecords();
  }, []);

  const fetchSoapRecords = async () => {
    setLoading(true);
    try {
      // Fetch all medical records (SOAP) from medical_records table
      const { data, error } = await supabase
        .from('medical_records')
        .select(`
          *,
          patient:patients(id, full_name, rm_number),
          therapist:users!created_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by patient_id to show unique patients
      const grouped = {};
      
      data.forEach(record => {
        // Skip records where patient might have been deleted or is missing
        if (!record.patient) return;

        const patientId = record.patient_id;

        if (!grouped[patientId]) {
          grouped[patientId] = {
            patient: record.patient,
            records: [],
            lastDate: record.created_at,
            count: 0
          };
        }
        
        grouped[patientId].records.push(record);
        grouped[patientId].count++;
        
        // Ensure lastDate is the most recent one
        if (new Date(record.created_at) > new Date(grouped[patientId].lastDate)) {
          grouped[patientId].lastDate = record.created_at;
        }
      });

      // Convert to array and sort by most recent update first
      const sortedGroups = Object.values(grouped).sort((a, b) => 
        new Date(b.lastDate) - new Date(a.lastDate)
      );

      setPatientGroups(sortedGroups);
    } catch (err) {
      console.error('Error fetching SOAP records:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = patientGroups.filter(group => 
    group.patient.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.patient.rm_number && group.patient.rm_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePatientClick = (group) => {
    setSelectedPatientGroup(group);
    setDetailModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 font-medium">Memuat data evaluasi harian...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[600px]">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-blue-600" />
              Evaluasi Harian (SOAP)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Daftar pasien dengan catatan perkembangan SOAP dari terapis.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama pasien atau No RM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="mx-auto h-12 w-12 text-slate-300 mb-3">
                <ClipboardList className="h-full w-full" />
              </div>
              <p className="text-slate-900 font-medium">Tidak ada data ditemukan</p>
              <p className="text-sm text-slate-500 mt-1">
                {searchTerm ? 'Coba kata kunci pencarian lain.' : 'Belum ada evaluasi SOAP yang tercatat.'}
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <Card 
                key={group.patient.id} 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer border-slate-200 group overflow-hidden bg-white"
                onClick={() => handlePatientClick(group)}
              >
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400 w-full" />
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shadow-sm border border-blue-200">
                        {group.patient.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate pr-2" title={group.patient.full_name}>
                          {group.patient.full_name}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-0.5">
                          {group.patient.rm_number || 'No RM'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 whitespace-nowrap">
                      {group.count} Sesi
                    </Badge>
                  </div>
                  
                  <div className="space-y-2.5 text-sm text-slate-600 mb-5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">
                        Terakhir: <span className="font-medium text-slate-900">{format(new Date(group.lastDate), 'dd MMM yyyy', { locale: id })}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">
                        Oleh: {group.records[0]?.therapist?.full_name || 'Terapis'}
                      </span>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 justify-between group-hover:shadow-sm transition-all"
                    variant="outline"
                    size="sm"
                  >
                    <span className="font-medium">Lihat Detail SOAP</span>
                    <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <DailyEvaluationDetailModal 
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          patientData={selectedPatientGroup}
        />
      </div>
    </div>
  );
};

export default DailyEvaluationTab;