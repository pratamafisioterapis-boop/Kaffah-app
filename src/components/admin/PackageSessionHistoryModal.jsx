import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, User, UserCheck, Stethoscope, Banknote, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const PackageSessionHistoryModal = ({ isOpen, onClose, packageInfo, usedSessions }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      // VALIDASI HARD STOP
      if (!packageInfo?.id) {
        throw new Error('Package tracking ID tidak ditemukan.');
      }

      const limit =
        typeof usedSessions === 'number'
          ? usedSessions
          : (packageInfo.sessions_used || 0);

      const { data, error: fetchError } = await supabase
        .from('daily_recaps')
        .select(`
          *,
          patient:patients!patient_id(full_name),
          actual_patient:patients!actual_patient_id(full_name),
          therapist:physiotherapists!therapist_id(name)
        `)
        .eq('package_tracking_id', packageInfo.id)
        .order('recap_date', { ascending: true });

      if (fetchError) throw fetchError;

      const rawSessions = data || [];

      const finalSessions = rawSessions.slice(0, limit);
      setSessions(finalSessions);

    } catch (err) {
      console.error("Error fetching package sessions:", err);
      setError(err.message || "Gagal memuat riwayat sesi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && packageInfo) {
      fetchSessions();
    } else {
      // Reset state when closed
      setSessions([]);
      setError(null);
    }
  }, [isOpen, packageInfo]);


  const getPatientDisplay = (recap) => {
    // If actual_patient exists, use that (the person treated)
    // Otherwise fall back to the main patient (the owner) or guest name
    if (recap.actual_patient?.full_name) return recap.actual_patient.full_name;
    if (recap.guest_name) return `${recap.guest_name} (Guest)`;
    return recap.patient?.full_name || '-';
  };

  const showOwnerColumn = sessions.some(session => 
    session.actual_patient_id && session.actual_patient_id !== session.patient_id
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span>Riwayat Sesi</span>
            {packageInfo?.package_name && (
              <Badge variant="outline" className="font-normal text-slate-500 bg-slate-50">
                {packageInfo.package_name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Memuat riwayat sesi...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-3 p-6 text-center">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSessions}>Coba Lagi</Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
              <Calendar className="w-8 h-8 opacity-20" />
              <p className="text-sm">
                {usedSessions === 0 
                  ? "Belum ada sesi yang digunakan (0 terpakai)." 
                  : "Tidak ditemukan data sesi yang sesuai."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-[50px] text-center">No</TableHead>
                  <TableHead className="w-[120px]">Tanggal</TableHead>
                  <TableHead>Pasien</TableHead>
                  {showOwnerColumn && <TableHead>Pemilik Paket</TableHead>}
                  <TableHead>Fisioterapis</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session, index) => {
                  const isShared = session.actual_patient_id && session.actual_patient_id !== session.patient_id;
                  
                  return (
                    <TableRow key={session.id} className="hover:bg-slate-50">
                      <TableCell className="text-center font-medium text-slate-500">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {session.recap_date ? format(new Date(session.recap_date), 'dd MMM yyyy', { locale: id }) : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium text-slate-800">
                          <User className="w-3 h-3 text-slate-400" />
                          {getPatientDisplay(session)}
                        </div>
                      </TableCell>
                      {showOwnerColumn && (
                        <TableCell>
                          {isShared ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <UserCheck className="w-3 h-3 text-slate-400" />
                              {session.patient?.full_name || '-'}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Stethoscope className="w-3 h-3 text-slate-400" />
                          {session.therapist_name || session.therapist?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700">
                        {formatCurrency(session.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100">
          <div className="flex justify-between items-center w-full text-xs text-slate-500">
            <span>Total: {sessions.length} Sesi Ditampilkan (dari {usedSessions || 0} terpakai)</span>
            <Button variant="outline" onClick={onClose}>Tutup</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PackageSessionHistoryModal;