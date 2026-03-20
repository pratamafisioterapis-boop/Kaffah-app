import React from 'react';
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
        </div>
    );
};

export default CenteredPatientTable;