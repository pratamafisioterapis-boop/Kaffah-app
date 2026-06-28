import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Loader2, ChevronLeft, ChevronRight, User
} from 'lucide-react';
import { cn } from "@/lib/utils";

const CenteredPatientTable = ({ 
    patients, 
    loading, 
    pagination, 
    filters, 
    onPaginationChange, 
    onFilterChange, 
    onRefresh,
    onRowClick // New prop for handling row clicks
}) => {
    const [selectedPatient, setSelectedPatient] = useState(null);
const [isOpen, setIsOpen] = useState(false);
const [historyData, setHistoryData] = useState([]);
const [loadingHistory, setLoadingHistory] = useState(false);
useEffect(() => {
  if (!selectedPatient) return;

  const fetchHistory = async () => {
    setLoadingHistory(true);

    // Coba pakai actual_patient_id dulu, lalu fallback ke patient_id
    const { data: dataActual } = await supabase
      .from('daily_recaps_with_labels')
      .select('recap_date, therapist_name, service_type, package_type, patient_type, diagnosis_labels, amount')
      .eq('actual_patient_id', selectedPatient.id)
      .order('recap_date', { ascending: false });

    const { data: dataPatient } = await supabase
      .from('daily_recaps_with_labels')
      .select('recap_date, therapist_name, service_type, package_type, patient_type, diagnosis_labels, amount')
      .eq('patient_id', selectedPatient.id)
      .is('actual_patient_id', null)
      .order('recap_date', { ascending: false });

    // Gabung dan deduplicate berdasarkan recap_date + amount
    const combined = [...(dataActual || []), ...(dataPatient || [])];
    const seen = new Set();
    const data = combined.filter(item => {
      const key = `${item.recap_date}_${item.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => new Date(b.recap_date) - new Date(a.recap_date));

    const error = null;

    if (!error) {
      setHistoryData(data || []);
    }

    setLoadingHistory(false);
  };

  if (isOpen) {
    fetchHistory();
  }
}, [selectedPatient, isOpen]);
    // Derived values
    const { page, totalPages } = pagination;
    const { search, status, completeness } = filters;

    // Handlers
    const handleSearchChange = (e) => {
        onFilterChange({ ...filters, search: e.target.value });
    };

    const handleStatusFilter = (val) => {
        onFilterChange({ ...filters, status: val });
    };

    const handleCompletenessFilter = (val) => {
        onFilterChange({ ...filters, completeness: val });
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            onPaginationChange({ ...pagination, page: newPage });
        }
    };
const formatTanggal = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white rounded-t-xl">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Cari nama, RM, atau No HP..." 
                            value={search}
                            onChange={handleSearchChange}
                            className="pl-9 h-9 text-xs"
                        />
                    </div>
                    
                    <select 
                        value={status}
                        onChange={(e) => handleStatusFilter(e.target.value)}
                        className="h-9 text-xs border border-slate-200 rounded-md px-2 bg-white outline-none focus:border-indigo-500"
                    >
                        <option value="all">Semua Status</option>
                        <option value="aktif">Aktif</option>
                        <option value="nonaktif">Nonaktif</option>
                    </select>

                    <select 
                         value={completeness}
                         onChange={(e) => handleCompletenessFilter(e.target.value)}
                         className="h-9 text-xs border border-slate-200 rounded-md px-2 bg-white outline-none focus:border-indigo-500"
                    >
                        <option value="all">Semua Kelengkapan</option>
                        <option value="complete">Lengkap</option>
                        <option value="incomplete">Belum Lengkap</option>
                    </select>
                </div>
            </div>

            {/* Table Area */}
            <div className="relative overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            {/* 1. No RM */}
                            <TableHead className="w-[100px] text-center font-semibold text-slate-700">No RM</TableHead>
                            {/* 2. Nama Pasien (Left Align) */}
                            <TableHead className="text-left font-semibold text-slate-700 min-w-[200px]">Nama Pasien</TableHead>
                            {/* 3. Gender */}
                            <TableHead className="text-center font-semibold text-slate-700 w-[60px]">Gender</TableHead>
                            {/* 4. Usia */}
                            <TableHead className="text-center font-semibold text-slate-700 w-[80px]">Usia</TableHead>
                            {/* 5. Tgl Lahir */}
                            <TableHead className="text-center font-semibold text-slate-700 min-w-[150px]">Tgl Lahir</TableHead>
                            {/* 6. No HP */}
                            <TableHead className="text-center font-semibold text-slate-700">Nomor HP</TableHead>
                            {/* 7. Info Tambahan */}
                            <TableHead className="text-center font-semibold text-slate-700">Info Tambahan</TableHead>
                            {/* 8. Status */}
                            <TableHead className="text-center font-semibold text-slate-700">Status</TableHead>
                            {/* 9. Kelengkapan */}
                            <TableHead className="text-center font-semibold text-slate-700">Kelengkapan</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
                                        <p className="text-xs">Memuat data pasien...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : patients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-48 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <User className="h-10 w-10 text-slate-200 mb-2" />
                                        <p>Tidak ada data pasien ditemukan.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            patients.map((patient, idx) => (
                                <TableRow 
                                    key={patient.id} 
                                    className={cn(
                                        "group transition-colors hover:bg-slate-50 cursor-pointer",
                                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                                    )}
                                    onClick={() => onRowClick && onRowClick(patient)}
                                >
                                    {/* 1. No RM */}
                                    <TableCell className="font-mono text-xs font-medium text-slate-600 text-center">
                                        {patient.medical_record_number || '-'}
                                    </TableCell>
                                    
                                    {/* 2. Nama Pasien + Nickname */}
                                    <TableCell className="text-left">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-800 text-sm">{patient.full_name}</span>
                                            <span className="text-xs text-slate-400">{patient.nickname || '-'}</span>
                                        </div>
                                    </TableCell>
                                    
                                    {/* 3. Gender */}
                                    <TableCell className="text-slate-600 text-xs text-center font-medium">
                                        {patient.gender}
                                    </TableCell>
                                    
                                    {/* 4. Usia */}
                                    <TableCell className="text-slate-600 text-xs text-center">
                                        {patient.formattedAge}
                                    </TableCell>
                                    
                                    {/* 5. Tgl Lahir */}
                                    <TableCell className="text-slate-600 text-xs text-center capitalize">
                                        {patient.formattedBirthDate}
                                    </TableCell>
                                    
                                    {/* 6. No HP */}
                                    <TableCell className="text-slate-600 text-xs font-mono text-center">
                                        {patient.formattedPhone}
                                    </TableCell>

                                    {/* 7. Info Tambahan */}
                                    <TableCell className="text-slate-600 text-xs text-center">
                                        {patient.additionalInfoLabel}
                                    </TableCell>
                                    
                                    {/* 8. Status */}
                                    <TableCell className="text-center">
                                        <Badge 
                                            variant="outline" 
                                            className={cn("font-normal text-[10px] px-2 py-0.5 border-0", patient.statusClass)}
                                        >
                                            {patient.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </TableCell>
                                    
                                    {/* 9. Kelengkapan */}
                                    <TableCell className="text-center">
                                        <Badge 
                                            variant="outline" 
                                            className={cn("font-normal text-[10px] px-2 py-0.5 border-0", patient.completenessClass)}
                                        >
                                            {patient.isComplete ? 'Lengkap' : 'Tidak Lengkap'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
  <Button 
    variant="outline" 
    size="sm"
    onClick={(e) => {
  e.stopPropagation();
  setSelectedPatient(patient);
  setIsOpen(true);
}}
  >
    Riwayat
  </Button>
</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-xl">
                <div className="text-xs text-slate-500">
                    Hal <span className="font-medium">{page}</span> dari <span className="font-medium">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1 || loading}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages || loading}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            {isOpen && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-xl w-[900px] max-h-[80vh] overflow-y-auto shadow-xl">
      <h2 className="text-lg font-bold mb-2">Riwayat Kunjungan</h2>
      
      <p className="text-sm text-slate-600 mb-4">
  {selectedPatient?.full_name}
</p>

{/* 🔥 TARUH DI SINI */}
{loadingHistory ? (
  <p className="text-sm text-slate-500">Loading...</p>
) : historyData.length === 0 ? (
  <p className="text-sm text-slate-500">Belum ada riwayat</p>
) : (
  <>
    <p className="text-xs text-slate-500 mb-2">
      Total Kunjungan: <span className="font-semibold">{historyData.length}</span>
    </p>

    <div className="max-h-[500px] overflow-y-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-xs text-slate-600 sticky top-0">
  <tr>
    <th className="p-3 text-left">Tanggal</th>
    <th className="p-3 text-left">Diagnosa</th>
    <th className="p-3 text-left">Tipe Pasien</th>
    <th className="p-3 text-left">Tipe Paket</th>
    <th className="p-3 text-left">Fisioterapis</th>
    <th className="p-3 text-right">Nominal</th>
  </tr>
</thead>

        <tbody>
          {historyData.map((item, i) => (
            <tr 
              key={i} 
              className="border-t hover:bg-slate-50 transition"
            >
              <td className="p-3 text-slate-700">
  {formatTanggal(item.recap_date)}
</td>

<td className="p-3 text-sm text-slate-600 max-w-[250px] whitespace-normal break-words">
  {Array.isArray(item.diagnosis_labels)
  ? item.diagnosis_labels.join(', ')
  : item.diagnosis_labels || '-'}
</td>

<td className="p-3 text-xs">
  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
    {item.patient_type || '-'}
  </span>
</td>

<td className="p-3 text-xs">
  {item.package_type ? (
    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
      {item.package_type}
    </span>
  ) : (
    <span className="text-slate-400">Non Paket</span>
  )}
</td>

<td className="p-3 text-xs text-slate-600">
  {item.therapist_name || '-'}
</td>

<td className="p-3 text-right font-semibold text-slate-800">
  {item.amount 
    ? `Rp ${item.amount.toLocaleString('id-ID')}` 
    : '-'}
</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
)}

<Button 
  className="mt-4"
  onClick={() => setIsOpen(false)}
>
  Tutup
</Button>
    </div>
  </div>
)}
        </div>
    );
};

export default CenteredPatientTable;