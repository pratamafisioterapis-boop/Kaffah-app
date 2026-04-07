import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Calendar, User, CreditCard, Receipt, PlayCircle, StopCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getDailyRecaps, getPatientById, updateDailyRecap, setDailyRecapStartTime, setDailyRecapEndTime } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { formatTimeIndonesia, getPatientName } from '@/lib/utils';
import InvoiceModal from '@/components/admin/InvoiceModal';
import { useToast } from '@/components/ui/use-toast';

const DailyRecapsDetailModal = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  packageName,
  startDate,
  endDate
}) => {
  const { toast } = useToast();
  const [recaps, setRecaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    if (isOpen && patientId && packageName) {
      fetchRecaps();
    }
  }, [isOpen, patientId, packageName, startDate, endDate]);

  const fetchRecaps = async () => {
    setLoading(true);
    try {
      const formattedStart = startDate ? new Date(startDate).toISOString().split('T')[0] : null;
      const formattedEnd = endDate ? new Date(endDate).toISOString().split('T')[0] : null;

      const { data } = await getDailyRecaps({
        startDate: formattedStart,
        endDate: formattedEnd,
        limit: 'all' 
      });

      if (data) {
        const filtered = data.filter(recap => {
            const isPackageMatch = recap.package_type && 
                recap.package_type.toLowerCase().includes(packageName.toLowerCase());
            const isPatientMatch = 
                recap.actual_patient_id === patientId || 
                (!recap.actual_patient_id && recap.patient_id === patientId);
            return isPackageMatch && isPatientMatch;
        });
        setRecaps(filtered);
      }
    } catch (error) {
      console.error("Failed to fetch detailed recaps", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInvoice = async (recap) => {
  let patientDetails = null;

  try {
    const { data } = await getPatientById(recap.actual_patient_id || recap.patient_id);
    patientDetails = data;
  } catch (e) {
    console.error("Failed to fetch patient details for invoice", e);
  }

  // 🔥 CEK: apakah sudah ada invoice
  const { data: existingInvoice } = await supabase
    .from('invoice_records')
    .select('invoice_number')
    .eq('daily_recap_id', recap.id)
    .maybeSingle();

  const invoiceData = {
    ...recap,
    patient_name: getPatientName(recap),
    patient_address: patientDetails?.address || '-',
    patient_phone: patientDetails?.phone || '-',
    rm_number: recap.actual_patient?.rm_number || recap.patient?.rm_number || '-',
    discount: 0,
    existing_invoice: existingInvoice?.invoice_number || null
  };

  setSelectedInvoiceData(invoiceData);
  setInvoiceModalOpen(true);
};

  const handleTimeClick = async (recap) => {
    if (recap.is_virtual) {
        toast({ title: "Action Required", description: "Virtual appointments cannot be started from detail view yet. Please use Daily Recaps main view." });
        return;
    }
    
    setActionLoadingId(recap.id);
    try {
        if (!recap.start_time) {
            const { error } = await setDailyRecapStartTime(recap.id);
            if (error) throw error;
            toast({ title: "Session Started", description: "Waktu mulai telah dicatat." });
        } else if (!recap.end_time) {
            const { error } = await setDailyRecapEndTime(recap.id);
            if (error) throw error;
            toast({ title: "Session Ended", description: "Waktu selesai telah dicatat." });
        }
        await fetchRecaps();
    } catch (error) {
        toast({ variant: "destructive", title: "Failed", description: error.message });
    } finally {
        setActionLoadingId(null);
    }
  };

  const renderDiagnosis = (diagnosis) => {
      if (Array.isArray(diagnosis)) {
          return diagnosis.map(d => typeof d === 'string' ? d : JSON.stringify(d)).join(', ');
      }
      if (typeof diagnosis === 'object' && diagnosis !== null) {
          return JSON.stringify(diagnosis);
      }
      return diagnosis || '-';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail Kunjungan</DialogTitle>
            <div className="text-sm text-slate-500 flex flex-col gap-1 mt-2">
              <div className="flex items-center gap-2"><User className="w-3 h-3" /> <span className="font-medium text-slate-700">{patientName}</span></div>
              <div className="flex items-center gap-2"><CreditCard className="w-3 h-3" /> Paket: {packageName}</div>
              {(startDate || endDate) && (<div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> {startDate ? format(new Date(startDate), 'dd MMM yyyy', { locale: localeId }) : 'Awal'} {' - '} {endDate ? format(new Date(endDate), 'dd MMM yyyy', { locale: localeId }) : 'Sekarang'}</div>)}
            </div>
          </DialogHeader>

          <div className="border rounded-md max-h-[60vh] overflow-y-auto mt-4">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Layanan</TableHead>
                  <TableHead>Terapis</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
                ) : recaps.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-slate-400 italic">Tidak ada data kunjungan ditemukan.</TableCell></TableRow>
                ) : (
                  recaps.map((recap) => {
                    const startTime = recap.start_time ? formatTimeIndonesia(recap.start_time) : '-';
                    const endTime = recap.end_time ? formatTimeIndonesia(recap.end_time) : '-';
                    const isLoading = actionLoadingId === recap.id;

                    return (
                        <TableRow key={recap.id}>
                        <TableCell className="font-medium">
                            {format(new Date(recap.recap_date), 'dd MMM yyyy', { locale: localeId })}
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="font-normal bg-slate-50">{recap.service_type || '-'}</Badge>
                            <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{renderDiagnosis(recap.diagnosis)}</div>
                        </TableCell>
                        <TableCell>{recap.therapist_name || '-'}</TableCell>
                        <TableCell>
                            <div className="flex flex-col items-center gap-1 justify-center h-full">
                                {startTime !== '-' && endTime !== '-' ? (
                                    <div className="text-[10px] font-mono text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100">{startTime} - {endTime}</div>
                                ) : (
                                    <Button 
                                        size="sm" 
                                        variant={startTime === '-' ? "outline" : "default"} 
                                        className={startTime === '-' ? "h-6 text-[10px] gap-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" : "h-6 text-[10px] gap-1 px-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"} 
                                        onClick={() => handleTimeClick(recap)}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 
                                          startTime === '-' ? <><PlayCircle className="w-3 h-3" /> Start</> : <><StopCircle className="w-3 h-3" /> End</>
                                        }
                                    </Button>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => handleOpenInvoice(recap)} title="Cetak Invoice"><Receipt className="w-4 h-4" /></Button>
                        </TableCell>
                        </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <InvoiceModal isOpen={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} data={selectedInvoiceData} />
    </>
  );
};

export default DailyRecapsDetailModal;