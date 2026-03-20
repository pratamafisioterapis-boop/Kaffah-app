import React, { useState } from 'react';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    Search, ChevronLeft, ChevronRight, Filter, Plus
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { formatDateIndonesian } from '@/lib/dateFormatHelpers';
import { cn } from '@/lib/utils';

// Import Modals
import PatientAddModal from '@/components/owner/PatientAddModal';
import PatientEditModal from '@/components/owner/PatientEditModal';

const PatientTable = ({ 
    patients = [], 
    loading = false, 
    pagination = { page: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 },
    filters = { search: '', completeness: 'all', status: 'all' },
    onPaginationChange,
    onFilterChange,
    onRefresh 
}) => {
    const { toast } = useToast();
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

    // Handlers
    const handleRowClick = (patient) => {
        setSelectedPatient(patient);
        setIsEditModalOpen(true);
    };

    const handleSuccess = (data) => {
        onRefresh(); // Refresh table data
    };

    // Helper to update specific filter
    const updateFilter = (key, value) => {
        onFilterChange({ ...filters, [key]: value });
    };

    // Pagination Helpers
    const { page, totalPages, totalItems, itemsPerPage } = pagination;

    const renderPaginationButtons = () => {
        const buttons = [];
        const maxButtons = 5;
        let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            buttons.push(
                <Button
                    key={i}
                    variant={page === i ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 ${page === i ? 'bg-indigo-600' : ''}`}
                    onClick={() => onPaginationChange({ ...pagination, page: i })}
                >
                    {i}
                </Button>
            );
        }
        return buttons;
    };

    return (
        <div className="space-y-4">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                
                {/* Search & Filters */}
                <div className="flex-1 w-full bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input 
                            placeholder="Cari No RM, Nama, atau No HP..." 
                            value={filters.search}
                            onChange={(e) => updateFilter('search', e.target.value)}
                            className="pl-9 border-none bg-transparent focus-visible:ring-0"
                        />
                    </div>
                    <div className="w-full md:w-40 border-l border-slate-100 pl-2">
                        <Select value={filters.completeness} onValueChange={(val) => updateFilter('completeness', val)}>
                            <SelectTrigger className="border-none bg-transparent focus:ring-0 h-9">
                                <SelectValue placeholder="Kelengkapan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Data</SelectItem>
                                <SelectItem value="complete">Lengkap</SelectItem>
                                <SelectItem value="incomplete">Tidak Lengkap</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-40 border-l border-slate-100 pl-2">
                        <Select value={filters.status} onValueChange={(val) => updateFilter('status', val)}>
                            <SelectTrigger className="border-none bg-transparent focus:ring-0 h-9">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="aktif">Aktif</SelectItem>
                                <SelectItem value="non-aktif">Nonaktif</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Add Button */}
                <Button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Pasien
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                            <TableRow>
                                <TableHead className="w-[100px] font-semibold text-slate-700">No RM</TableHead>
                                <TableHead className="min-w-[200px] font-semibold text-slate-700">Nama Pasien</TableHead>
                                <TableHead className="w-[80px] font-semibold text-slate-700">Usia</TableHead>
                                <TableHead className="min-w-[120px] font-semibold text-slate-700">Tgl Lahir</TableHead>
                                <TableHead className="w-[80px] font-semibold text-slate-700">Gender</TableHead>
                                <TableHead className="min-w-[150px] font-semibold text-slate-700">Info Tambahan</TableHead>
                                <TableHead className="min-w-[140px] font-semibold text-slate-700">No Handphone</TableHead>
                                <TableHead className="w-[140px] font-semibold text-slate-700">Kelengkapan</TableHead>
                                <TableHead className="w-[100px] text-right font-semibold text-slate-700 pr-6">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-6 w-16 rounded-full ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : patients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-40 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Filter className="w-10 h-10 text-slate-300 mb-2" />
                                            <p>Tidak ada data pasien yang ditemukan.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                patients.map((patient, idx) => (
                                    <TableRow 
                                        key={patient.id} 
                                        className={cn(
                                            "cursor-pointer transition-colors hover:bg-slate-100", 
                                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                                        )}
                                        onClick={() => handleRowClick(patient)}
                                    >
                                        <TableCell className="font-mono text-slate-600 font-medium">
                                            {patient.medical_record_number}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{patient.full_name}</span>
                                                {patient.nickname && (
                                                    <span className="text-xs text-slate-500 italic">
                                                        ({patient.nickname})
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{patient.formattedAge}</TableCell>
                                        <TableCell>{formatDateIndonesian(patient.birth_date)}</TableCell>
                                        <TableCell>{patient.gender}</TableCell>
                                        <TableCell className="text-sm text-slate-500 truncate max-w-[150px]">
                                            {patient.patient_info_options?.label || '-'}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-slate-600">
                                            {patient.formattedPhone}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={patient.completenessClass}>
                                                {patient.isComplete ? 'Lengkap' : 'Tdk Lengkap'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Badge variant="outline" className={`${patient.statusClass} capitalize`}>
                                                {patient.status || 'Non-Aktif'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 hidden sm:inline">Baris per halaman:</span>
                        <Select 
                            value={String(itemsPerPage)} 
                            onValueChange={(val) => {
                                onPaginationChange({ ...pagination, itemsPerPage: Number(val), page: 1 });
                            }}
                        >
                            <SelectTrigger className="w-[70px] h-8 border-slate-300">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-sm text-slate-600">
                            Hal {page} dari {totalPages || 1}
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onPaginationChange({ ...pagination, page: Math.max(1, page - 1) })}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            
                            <div className="hidden md:flex gap-1">
                                {renderPaginationButtons()}
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onPaginationChange({ ...pagination, page: Math.min(totalPages, page + 1) })}
                                disabled={page === totalPages || totalPages === 0}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <PatientAddModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                onSuccess={handleSuccess} 
            />
            
            <PatientEditModal 
                isOpen={isEditModalOpen} 
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedPatient(null);
                }} 
                onSuccess={handleSuccess}
                patient={selectedPatient}
            />
        </div>
    );
};

export default PatientTable;