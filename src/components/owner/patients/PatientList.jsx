import React, { useState, useEffect } from 'react';
import { 
  Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, 
  ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPatients } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PatientList = ({ onEdit, onDelete, refreshTrigger }) => {
  const { toast } = useToast();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sort State
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  useEffect(() => {
    fetchPatients();
  }, [refreshTrigger]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const { data, error } = await getPatients();
      if (error) throw error;
      // Defensive check to ensure data is an array
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading patients:", error);
      toast({ 
        variant: "destructive", 
        title: "Gagal memuat data", 
        description: error.message 
      });
      setPatients([]); // Fallback to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Safe data initialization
  const safePatients = Array.isArray(patients) ? patients : [];

  // Filter & Sort Logic
  const filteredPatients = safePatients.filter(p => {
    if (!p) return false;
    const term = searchTerm.toLowerCase() || '';
    
    // Null-safe property access and fallback
    const name = p.full_name?.toLowerCase() || '';
    const rm = p.rm_number?.toLowerCase() || '';
    const phone = p.phone || '';
    const email = p.email?.toLowerCase() || '';

    // Safe comparison
    return name.includes(term) || rm.includes(term) || phone.includes(term) || email.includes(term);
  }).sort((a, b) => {
    if (!a || !b) return 0;
    if (!sortConfig.key) return 0;
    
    const getValue = (obj, key) => {
      // Safe property access using optional chaining and fallback
      const val = obj?.[key];
      return val === null || val === undefined ? '' : val;
    };

    const aVal = getValue(a, sortConfig.key);
    const bVal = getValue(b, sortConfig.key);
    
    // Handle string comparisons gracefully
    if (typeof aVal === 'string' && typeof bVal === 'string') {
        const lowerA = aVal.toLowerCase();
        const lowerB = bVal.toLowerCase();
        if (lowerA < lowerB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (lowerA > lowerB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    }
    
    // Handle standard comparisons
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Logic
  const totalItems = filteredPatients.length;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Cari nama, RM, telepon, email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to page 1 on search
            }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchPatients} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('rm_number')}>
                  <div className="flex items-center">No. RM <SortIcon column="rm_number" /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('full_name')}>
                  <div className="flex items-center">Nama Lengkap <SortIcon column="full_name" /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('phone')}>
                  <div className="flex items-center">Telepon <SortIcon column="phone" /></div>
                </th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
                    </div>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    {patients.length === 0 ? "Belum ada data pasien." : "Tidak ada hasil pencarian."}
                  </td>
                </tr>
              ) : (
                currentData.map((patient) => {
                  // Guard clause: Ensure patient object exists
                  if (!patient) return null;

                  return (
                    <tr key={patient?.id || Math.random()} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-blue-600 font-medium">
                        {patient?.rm_number || '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {patient?.full_name || 'Nama Tidak Tersedia'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {patient?.phone || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                         <div className="flex justify-end gap-2">
                             <Button variant="ghost" size="sm" onClick={() => onEdit && onEdit(patient)}>
                                <Edit className="w-4 h-4 mr-1" /> Edit
                             </Button>
                             {onDelete && (
                                 <Button variant="ghost" size="sm" onClick={() => onDelete(patient)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4 mr-1" /> Hapus
                                 </Button>
                             )}
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {!loading && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
          <div className="text-sm text-slate-500 order-2 sm:order-1">
            Menampilkan <span className="font-medium text-slate-900">{startIndex + 1}</span> sampai <span className="font-medium text-slate-900">{endIndex}</span> dari <span className="font-medium text-slate-900">{totalItems}</span> data
          </div>
          
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-slate-500 hidden sm:inline">Baris per halaman:</span>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(val) => {
                  setItemsPerPage(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium px-2">
                Halaman {currentPage}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientList;