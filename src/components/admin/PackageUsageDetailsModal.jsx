import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown, User, Calendar, FileText, ExternalLink } from 'lucide-react';
import { getPackageUsageHistory } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const PackageUsageDetailsModal = ({ isOpen, onClose, packageId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [packageInfo, setPackageInfo] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Sorting
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' or 'asc'

  useEffect(() => {
    if (isOpen && packageId) {
        fetchHistory();
    } else {
        // Reset state on close
        setData([]);
        setPackageInfo(null);
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
    }
  }, [isOpen, packageId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
        const filters = {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            patientName: searchTerm || undefined,
            sort: sortOrder
        };
        const { data: history, packageInfo: pkg } = await getPackageUsageHistory(packageId, filters);
        
        setData(history || []);
        setPackageInfo(pkg);
    } catch (error) {
        console.error("Failed to fetch package history:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleSort = () => {
      const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      setSortOrder(newOrder);
      // Re-fetch or local sort? Re-fetching ensures consistent DB sort, but local is faster.
      // Since we fetch 'all' mostly for history, let's just reverse local data for speed if no filters changed
      const sorted = [...data].reverse();
      setData(sorted);
  };

  const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      try {
          return format(new Date(dateStr), 'dd MMM yyyy', { locale: localeId });
      } catch (e) { return dateStr; }
  };

  const handleRefresh = () => {
      fetchHistory();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
         <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex flex-col gap-1">
                <span>Riwayat Penggunaan Paket</span>
                {packageInfo && (
                    <span className="text-sm font-normal text-slate-500">
                        {packageInfo.package_name} • Owner: <span className="font-medium text-slate-700">{packageInfo.patient?.full_name}</span>
                    </span>
                )}
            </DialogTitle>
         </DialogHeader>

         <div className="p-6 pt-2 space-y-4 flex-1 overflow-hidden flex flex-col">
             {/* Filter Bar */}
             <div className="flex flex-wrap items-end gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Cari Pasien</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input 
                            placeholder="Nama pasien..." 
                            className="h-9 w-40 pl-8 text-xs bg-white" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Tanggal Mulai</label>
                    <Input 
                        type="date" 
                        className="h-9 w-32 text-xs bg-white" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Tanggal Akhir</label>
                    <Input 
                        type="date" 
                        className="h-9 w-32 text-xs bg-white" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                 </div>
                 <Button size="sm" onClick={handleRefresh} className="h-9 bg-blue-600 hover:bg-blue-700">
                     Filter
                 </Button>
             </div>

             {/* Table */}
             <div className="border rounded-md flex-1 overflow-y-auto">
                 <Table>
                     <TableHeader className="bg-slate-50 sticky top-0 z-10">
                         <TableRow>
                             <TableHead className="w-[140px]">
                                 <button onClick={handleSort} className="flex items-center gap-1 hover:text-slate-900 font-semibold text-slate-600">
                                     <Calendar className="w-3.5 h-3.5" /> Tanggal
                                     {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                 </button>
                             </TableHead>
                             <TableHead>
                                 <div className="flex items-center gap-1 font-semibold text-slate-600">
                                     <User className="w-3.5 h-3.5" /> Pasien Pengguna
                                 </div>
                             </TableHead>
                             <TableHead>
                                 <div className="flex items-center gap-1 font-semibold text-slate-600">
                                     <FileText className="w-3.5 h-3.5" /> Info Sesi & Diagnosa
                                 </div>
                             </TableHead>
                         </TableRow>
                     </TableHeader>
                     <TableBody>
                         {loading ? (
                             <TableRow>
                                 <TableCell colSpan={3} className="h-32 text-center">
                                     <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                                     <span className="text-slate-500 text-xs">Memuat riwayat...</span>
                                 </TableCell>
                             </TableRow>
                         ) : data.length === 0 ? (
                             <TableRow>
                                 <TableCell colSpan={3} className="h-32 text-center text-slate-400 italic text-sm">
                                     Tidak ada riwayat penggunaan ditemukan.
                                 </TableCell>
                             </TableRow>
                         ) : (
                             data.map((row) => {
                                 // Determine display name: Actual Patient Name (if exists) > Package Owner Name
                                 const actualName = row.actual_patient?.full_name;
                                 const ownerName = row.patient?.full_name;
                                 const displayName = actualName || ownerName || '-';
                                 
                                 // Check if user is different from owner
                                 const isDifferent = actualName && ownerName && actualName !== ownerName;

                                 return (
                                     <TableRow key={row.id} className="hover:bg-slate-50">
                                         <TableCell className="font-mono text-xs text-slate-600">
                                             {formatDate(row.recap_date)}
                                         </TableCell>
                                         <TableCell>
                                             <div className="flex flex-col">
                                                 <span className="font-medium text-sm text-slate-800">{displayName}</span>
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
                                                 <span className="text-xs text-slate-500">
                                                     {Array.isArray(row.diagnosis) && row.diagnosis.length > 0 
                                                         ? row.diagnosis.join(', ') 
                                                         : (row.diagnosis || '-')}
                                                 </span>
                                                 <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                     <span>{row.therapist_name}</span>
                                                     {row.service_type && <span>• {row.service_type}</span>}
                                                 </div>
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
  );
};

export default PackageUsageDetailsModal;