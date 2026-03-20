import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Calendar, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getPackageUsageHistory } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PackageUsageHistoryModal = ({ isOpen, onClose, packageData }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (isOpen && packageData?.id) {
      fetchHistory();
    } else {
      setHistory([]);
      setSearchTerm('');
      setDateRange({ start: '', end: '' });
    }
  }, [isOpen, packageData]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getPackageUsageHistory(packageData.id, {
        sort: sortOrder,
        startDate: dateRange.start,
        endDate: dateRange.end,
        patientName: searchTerm
      });
      setHistory(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch usage history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && packageData?.id) {
        fetchHistory();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, dateRange]);

  useEffect(() => {
     if (isOpen && packageData?.id) {
        fetchHistory();
     }
  }, [sortOrder]);

  const toggleSort = () => {
    setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Riwayat Penggunaan Paket</DialogTitle>
          <DialogDescription>
            {packageData?.packageName} • Owner: {packageData?.patient?.full_name || '-'}
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-4 py-4 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
               <span className="text-xs font-medium text-slate-500">Cari Pasien</span>
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Nama pasien..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
               </div>
            </div>
            
            <div className="space-y-1">
               <span className="text-xs font-medium text-slate-500">Tanggal Mulai</span>
               <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="h-9"
              />
            </div>
            
            <div className="space-y-1">
               <span className="text-xs font-medium text-slate-500">Tanggal Akhir</span>
               <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="h-9"
              />
            </div>

            <Button onClick={fetchHistory} className="bg-blue-600 hover:bg-blue-700 h-9">
               Filter
            </Button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-12 h-full">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mx-1">
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200 m-1">
              Belum ada riwayat penggunaan
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead 
                      className="w-[180px] cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={toggleSort}
                    >
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <Calendar className="w-4 h-4 mr-1" />
                        Tanggal
                        {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 ml-1 text-blue-600"/> : <ArrowDown className="w-3.5 h-3.5 ml-1 text-blue-600"/>}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Pasien Pengguna</TableHead>
                    <TableHead className="font-semibold text-slate-700">Info Sesi & Diagnosa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item, index) => {
                     // Logic to determine displayed name
                     const actualName = item.actual_patient?.full_name;
                     const ownerName = item.patient?.full_name;
                     const displayedName = actualName || ownerName || 'Unknown Patient';
                     const isDifferent = actualName && ownerName && actualName !== ownerName;

                     return (
                        <TableRow key={index} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-600">
                             {format(new Date(item.recap_date), 'dd MMM yyyy', { locale: localeId })}
                          </TableCell>
                          <TableCell>
                             <div className="flex flex-col">
                                <span className="font-semibold text-slate-900">{displayedName}</span>
                                {isDifferent && (
                                   <span className="text-[10px] text-slate-400">
                                      Owner: {ownerName}
                                   </span>
                                )}
                             </div>
                          </TableCell>
                          <TableCell>
                             <div className="space-y-1">
                                {item.session_info && (
                                   <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-normal mr-2">
                                      {item.session_info}
                                   </Badge>
                                )}
                                {item.diagnosis && Array.isArray(item.diagnosis) && item.diagnosis.length > 0 && item.diagnosis[0] !== '' && (
                                   <span className="text-sm text-slate-600">
                                     {item.diagnosis.join(', ')}
                                   </span>
                                )}
                             </div>
                          </TableCell>
                        </TableRow>
                     );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PackageUsageHistoryModal;