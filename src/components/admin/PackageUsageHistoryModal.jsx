import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { getPackageUsageHistory } from '@/lib/api';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Calendar,
  ArrowUp,
  ArrowDown,
  User,
  FileText,
  ExternalLink,
  Loader2
} from 'lucide-react';


const PackageUsageHistoryModal = ({ isOpen, onClose, packageId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [packageInfo, setPackageInfo] = useState(null);
  
  
  // Sorting
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' or 'asc'

  useEffect(() => {
  if (isOpen && packageId) {
    fetchHistory();
  }
}, [isOpen, packageId, sortOrder]);


    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data: history, packageInfo: pkg } =
                await getPackageUsageHistory(packageId);

            // 1️⃣ URUTKAN DARI PALING AWAL (SESSION 1 = PALING LAMA)
            const baseSorted = [...(history || [])].sort(
                (a, b) => new Date(a.recap_date) - new Date(b.recap_date)
            );

            // 2️⃣ TAMBAHKAN NOMOR SESI
            const withSessionNumber = baseSorted.map((row, index) => ({
                ...row,
                session_number: index + 1,
            }));

            // 3️⃣ SORT TAMPILAN (ASC / DESC)
            const finalSorted =
                sortOrder === 'desc'
                    ? [...withSessionNumber].reverse()
                    : withSessionNumber;

            setData(finalSorted);
            setPackageInfo(pkg || null);
        } catch (error) {
            console.error("Failed to fetch package history:", error);
        } finally {
            setLoading(false);
        }
    };


  const handleSort = () => {
  setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
};

  const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      try {
          return format(new Date(dateStr), 'dd MMM yyyy', { locale: localeId });
      } catch (e) { return dateStr; }
  };

  return (
    <>
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
             <DialogHeader className="p-6 pb-2">
                <div className="flex justify-between items-start">
                    <DialogTitle className="flex flex-col gap-1">
                        <span>Riwayat Penggunaan Paket</span>
                        {packageInfo && (
                            <span className="text-sm font-normal text-slate-500">
                                {packageInfo.package_name} • Owner: <span className="font-medium text-slate-700">{packageInfo.patient?.full_name}</span>
                                <span className="mx-2">•</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                                   Terpakai: {packageInfo.sessions_used} / {packageInfo.total_sessions}
                                </span>
                            </span>
                        )}
                    </DialogTitle>
                </div>
             </DialogHeader>
    
             <div className="p-6 pt-2 space-y-4 flex-1 overflow-hidden flex flex-col">
                
                 {/* Table */}
                 <div className="border rounded-md flex-1 overflow-y-auto">
                     <Table>
                              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                  <TableRow>
                                      {/* 🔢 KOLOM SESI */}
                                      <TableHead className="w-[60px] text-center font-semibold text-slate-600">
                                          Sesi
                                      </TableHead>

                                      <TableHead className="w-[140px]">
                                          <button
                                              onClick={handleSort}
                                              className="flex items-center gap-1 hover:text-slate-900 font-semibold text-slate-600"
                                          >
                                              <Calendar className="w-3.5 h-3.5" /> Tanggal
                                              {sortOrder === 'asc'
                                                  ? <ArrowUp className="w-3 h-3" />
                                                  : <ArrowDown className="w-3 h-3" />}
                                          </button>
                                      </TableHead>

                                      <TableHead>
                                          <div className="flex items-center gap-1 font-semibold text-slate-600">
                                              <User className="w-3.5 h-3.5" /> Pasien Pengguna
                                          </div>
                                      </TableHead>

                                      <TableHead>
                                          <div className="flex items-center gap-1 font-semibold text-slate-600">
                                              <FileText className="w-3.5 h-3.5" /> Info Sesi
                                          </div>
                                      </TableHead>
                                  </TableRow>
                              </TableHeader>

                         <TableBody>
                             {loading ? (
                                 <TableRow>
                                          <TableCell colSpan={4} className="h-32 text-center">
                                         <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                                         <span className="text-slate-500 text-xs">Memuat riwayat...</span>
                                     </TableCell>
                                 </TableRow>
                             ) : data.length === 0 ? (
                                 <TableRow>
                                     <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic text-sm">
                                         Tidak ada riwayat penggunaan ditemukan.
                                     </TableCell>
                                 </TableRow>
                             ) : (
                                 data.map((row) => {
                                     const actualName = row.actual_patient?.full_name;
                                     const ownerName = row.patient?.full_name;
                                     const displayName = actualName || ownerName || '-';
                                     const isDifferent = actualName && ownerName && actualName !== ownerName;

                                     return (
                                         <TableRow key={row.id} className="hover:bg-slate-50 cursor-pointer group">

                                             {/* 🔢 NOMOR SESI */}
                                             <TableCell className="text-center font-semibold text-slate-700">
                                                 {row.session_number}
                                             </TableCell>

                                             <TableCell className="font-mono text-xs text-slate-600">
                                                 {formatDate(row.recap_date)}
                                             </TableCell>

                                             <TableCell>
                                                 <div className="flex flex-col">
                                                     <div className="flex items-center gap-2">
                                                         <span className="font-medium text-sm text-slate-800">{displayName}</span>
                                                         <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                     </div>
                                                     {isDifferent && (
                                                         <span className="text-[10px] text-slate-400">
                                                             Owner: {ownerName}
                                                         </span>
                                                     )}
                                                 </div>
                                             </TableCell>
                                             <TableCell>
                                                 <div className="flex flex-col gap-1">
                                                     {row.session_info && (
                                                         <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit">
                                                             {row.session_info}
                                                         </span>
                                                     )}
                                                 </div>
                                             </TableCell>
                                         </TableRow>
                                     );
                                 })
                             )}
                         </TableBody>
                     </Table>
                 </div>
             </div>
          </DialogContent>
        </Dialog>

        
    </>
  );
};

export default PackageUsageHistoryModal;