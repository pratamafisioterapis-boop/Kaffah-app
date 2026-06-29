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
    onRowClick
}) => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
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
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 justify-between items-center bg-white rounded-t-xl">
                <div className="flex flex-wrap items-center gap-2 w-full">
                    <div className="relative flex-1 min-w-[160px]">
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

            {/* PWA CARD LAYOUT */}
            {isPWA ? (
                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
                            <p className="text-xs text-slate-400">Memuat data pasien...</p>
                        </div>
                    ) : patients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <User className="h-10 w-10 text-slate-200 mb-2" />
                            <p className="text-sm text-slate-500">Tidak ada data pasien ditemukan.</p>
                        </div>
                    ) : (
                        patients.map((patient, idx) => (
                            <div
                                key={patient.id}
                                onClick={() => onRowClick && onRowClick(patient)}
                                className={cn(
                                    "px-4 py-3 cursor-pointer active:bg-indigo-50 transition-colors",
                                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                )}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-mono text-[10px] text-indigo-500 font-semibold">
                                        {patient.medical_record_number || '-'}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className={cn("font-normal text-[10px] px-2 py-0 border-0", patient.statusClass)}>
                                            {patient.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                        <Badge variant="outline" className={cn("font-normal text-[10px] px-2 py-0 border-0", patient.completenessClass)}>
                                            {patient.isComplete ? 'Lengkap' : 'Belum'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mb-1">
                                    <p className="font-semibold text-slate-900 text-sm leading-tight">{patient.full_name}</p>
                                    {patient.nickname && <p className="text-xs text-slate-400">{patient.nickname}</p>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span>{patient.gender} · {patient.formattedAge}</span>
                                    <span className="text-slate-300">·</span>
                                    <span>{patient.formattedPhone}</span>
                                </div>
                                <div className="mt-2" onClick={e => e.stopPropagation()}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 w-full"
                                        onClick={() => { setSelectedPatient(patient); setIsOpen(true); }}
                                    >
                                        Lihat Riwayat Kunjungan
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
            /* DESKTOP TABLE */
            <div className="relative overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[100px] text-center font-semibold text-slate-700">No RM</TableHead>
                            <TableHead className="text-left font-semibold text-slate-700 min-w-[200px]">Nama Pasien</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700 w-[60px]">Gender</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700 w-[80px]">Usia</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700 min-w-[150px]">Tgl Lahir</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Nomor HP</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Info Tambahan</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Status</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Kelengkapan</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
                                        <p className="text-xs">Memuat data pasien...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : patients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-48 text-center text-slate-500">
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
                                    className={cn("group transition-colors hover:bg-slate-50 cursor-pointer", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}
                                    onClick={() => onRowClick && onRowClick(patient)}
                                >
                                    <TableCell className="font-mono text-xs font-medium text-slate-600 text-center">{patient.medical_record_number || '-'}</TableCell>
                                    <TableCell className="text-left">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-800 text-sm">{patient.full_name}</span>
                                            <span className="text-xs text-slate-400">{patient.nickname || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-xs text-center font-medium">{patient.gender}</TableCell>
                                    <TableCell className="text-slate-600 text-xs text-center">{patient.formattedAge}</TableCell>
                                    <TableCell className="text-slate-600 text-xs text-center capitalize">{patient.formattedBirthDate}</TableCell>
                                    <TableCell className="text-slate-600 text-xs font-mono text-center">{patient.formattedPhone}</TableCell>
                                    <TableCell className="text-slate-600 text-xs text-center">{patient.additionalInfoLabel}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn("font-normal text-[10px] px-2 py-0.5 border-0", patient.statusClass)}>
                                            {patient.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn("font-normal text-[10px] px-2 py-0.5 border-0", patient.completenessClass)}>
                                            {patient.isComplete ? 'Lengkap' : 'Tidak Lengkap'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); setIsOpen(true); }}>
                                            Riwayat
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            )}

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-xl">
                <div className="text-xs text-slate-500">
                    Hal <span className="font-medium">{page}</span> dari <span className="font-medium">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || loading} className="h-8 w-8 p-0">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages || loading} className="h-8 w-8 p-0">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Modal Riwayat */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className={cn("bg-white rounded-xl shadow-xl overflow-y-auto", isPWA ? "w-full max-h-[90vh]" : "w-[900px] max-h-[80vh]")}>
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Riwayat Kunjungan</h2>
                                <p className="text-xs text-slate-500 mt-0.5">{selectedPatient?.full_name}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>Tutup</Button>
                        </div>
                        <div className="p-5">
                            {loadingHistory ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-500" /></div>
                            ) : historyData.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">Belum ada riwayat kunjungan</p>
                            ) : (
                                <>
                                    <p className="text-xs text-slate-500 mb-3">Total Kunjungan: <span className="font-semibold">{historyData.length}</span></p>
                                    {isPWA ? (
                                        <div className="space-y-3">
                                            {historyData.map((item, i) => (
                                                <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-semibold text-slate-700">{formatTanggal(item.recap_date)}</p>
                                                        <span className="text-xs font-bold text-slate-800">{item.amount ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600">{Array.isArray(item.diagnosis_labels) ? item.diagnosis_labels.join(', ') : item.diagnosis_labels || '-'}</p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">{item.patient_type || '-'}</span>
                                                        {item.package_type ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">{item.package_type}</span> : <span className="text-[10px] text-slate-400">Non Paket</span>}
                                                        <span className="text-[10px] text-slate-500">{item.therapist_name || '-'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="border rounded-lg overflow-hidden">
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
                                                        <tr key={i} className="border-t hover:bg-slate-50 transition">
                                                            <td className="p-3 text-slate-700">{formatTanggal(item.recap_date)}</td>
                                                            <td className="p-3 text-xs text-slate-600 max-w-[250px] whitespace-normal break-words">{Array.isArray(item.diagnosis_labels) ? item.diagnosis_labels.join(', ') : item.diagnosis_labels || '-'}</td>
                                                            <td className="p-3 text-xs"><span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">{item.patient_type || '-'}</span></td>
                                                            <td className="p-3 text-xs">{item.package_type ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{item.package_type}</span> : <span className="text-slate-400">Non Paket</span>}</td>
                                                            <td className="p-3 text-xs text-slate-600">{item.therapist_name || '-'}</td>
                                                            <td className="p-3 text-right font-semibold text-slate-800">{item.amount ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CenteredPatientTable;