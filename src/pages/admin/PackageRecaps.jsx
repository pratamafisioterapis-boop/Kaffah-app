import React, { useState, useEffect } from 'react';
import { 
    Search, Plus, Package, Clock, CheckCircle, 
    AlertTriangle, Trash2, Loader2, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDateIndonesian } from '@/lib/dateFormatHelpers';
import { cn } from '@/lib/utils';
import AddPackageModal from '@/components/shared/AddPackageModal';
import ExtendPackageModal from '@/components/shared/ExtendPackageModal';
import PackageHistoryModal from '@/components/shared/PackageHistoryModal';
import EditPackageStatusModal from '@/components/admin/EditPackageStatusModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import DashboardLayout from '@/components/DashboardLayout';

// Shared Logic Component
export const PackageRecapsContent = () => {
    const { toast } = useToast();
    const [packages, setPackages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, aktif, pending, expired, selesai

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isEditStatusModalOpen, setIsEditStatusModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    
    const [selectedPackage, setSelectedPackage] = useState(null);

    useEffect(() => {
        fetchPackages();
    }, []);

    useEffect(() => {
        // Reset to first page whenever filters change
        setCurrentPage(1);
    }, [searchTerm, statusFilter, itemsPerPage]);

    const fetchPackages = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('package_tracking')
                .select(`
                    *,
                    patients:patient_id(full_name),
                    operational_options:package_type_id(label)
                `);

            if (error) throw error;
            setPackages(data || []);
        } catch (error) {
            console.error("Error fetching packages:", error);
            toast({ variant: "destructive", title: "Error", description: "Gagal memuat data paket." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRowClick = (pkg) => {
        setSelectedPackage(pkg);
        setIsHistoryModalOpen(true);
    };

    const handleExtendClick = (e, pkg) => {
        e.stopPropagation();
        setSelectedPackage(pkg);
        setIsExtendModalOpen(true);
    };

    const handleDeleteClick = (e, pkg) => {
        e.stopPropagation();
        setSelectedPackage(pkg);
        setIsDeleteConfirmOpen(true);
    };

    const handleEditStatusClick = (e, pkg) => {
        e.stopPropagation();
        setSelectedPackage(pkg);
        setIsEditStatusModalOpen(true);
    };

    const confirmDelete = async () => {
        try {
            const { error } = await supabase
                .from('package_tracking')
                .delete()
                .eq('id', selectedPackage.id);

            if (error) throw error;

            toast({ title: "Terhapus", description: "Paket berhasil dihapus." });
            fetchPackages();
            setIsDeleteConfirmOpen(false);
        } catch (error) {
            console.error("Error deleting package:", error);
            toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus paket." });
        }
    };

    // Calculate Counts
    const counts = {
        all: packages.length,
        aktif: packages.filter(p => ['aktif', 'diperpanjang'].includes((p.status||'').toLowerCase())).length,
        pending: packages.filter(p => ['pending', 'belum_dimulai'].includes((p.status||'').toLowerCase())).length,
        expired: packages.filter(p => (p.status||'').toLowerCase() === 'expired').length,
        selesai: packages.filter(p => ['selesai', 'habis'].includes((p.status||'').toLowerCase())).length,
    };

    // Sisa Hari Calculation
    const calculateSisaHari = (item) => {
        const status = (item.status || '').toLowerCase();
        const isActive = status === 'aktif' || status === 'diperpanjang' || status === 'active';
        
        if (!isActive) return null;

        const endDate = status === 'diperpanjang' && item.extended_until 
            ? new Date(item.extended_until) 
            : new Date(item.end_date);
        
        if (!endDate || isNaN(endDate.getTime())) return null;

        // Normalize to start of day for accurate day diff
        const today = new Date();
        today.setHours(0,0,0,0);
        endDate.setHours(0,0,0,0);

        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    };

    const getSisaHariColor = (days) => {
        if (days === null) return 'text-slate-400';
        if (days <= 0) return 'text-red-600 font-bold';
        if (days <= 7) return 'text-orange-600 font-bold';
        return 'text-green-600 font-bold';
    };

    // Filters and Sorting
    const filteredAndSortedPackages = React.useMemo(() => {
        let result = packages.filter(pkg => {
            // Search
            const patientName = pkg.patients?.full_name?.toLowerCase() || '';
            const searchMatch = patientName.includes(searchTerm.toLowerCase());
            
            // Status Filter - Normalized
            let statusMatch = true;
            const normalizedStatus = (pkg.status || '').toLowerCase().trim();
            
            if (statusFilter === 'aktif') {
                statusMatch = normalizedStatus === 'aktif' || normalizedStatus === 'diperpanjang';
            } else if (statusFilter === 'pending') {
                statusMatch = normalizedStatus === 'pending' || normalizedStatus === 'belum_dimulai';
            } else if (statusFilter === 'selesai') {
                statusMatch = ['selesai', 'habis', 'completed', 'done'].includes(normalizedStatus);
            } else if (statusFilter !== 'all') {
                statusMatch = normalizedStatus === statusFilter.toLowerCase();
            }

            return searchMatch && statusMatch;
        });

        // Default Sort: Active packages by nearest end_date first, then by newest start_date for all
        result.sort((a, b) => {
             const statusA = (a.status || '').toLowerCase();
             const statusB = (b.status || '').toLowerCase();
             const isActiveA = statusA === 'aktif' || statusA === 'diperpanjang';
             const isActiveB = statusB === 'aktif' || statusB === 'diperpanjang';

             // Priority 1: Active status on top
             if (isActiveA && !isActiveB) return -1;
             if (!isActiveA && isActiveB) return 1;

             if (isActiveA && isActiveB) {
                 // Priority 2: For active, nearest expiry (end_date ASC)
                 const endA = a.end_date ? new Date(a.end_date).getTime() : Infinity;
                 const endB = b.end_date ? new Date(b.end_date).getTime() : Infinity;
                 return endA - endB;
             }

             // Priority 3: For non-active (or active tie-breaker), newest start_date/created_at
             const dateA = a.start_date ? new Date(a.start_date).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
             const dateB = b.start_date ? new Date(b.start_date).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
             return dateB - dateA; // Newest first
        });

        return result;
    }, [packages, searchTerm, statusFilter]);

    // Pagination Logic
    const totalPages = Math.max(1, Math.ceil(filteredAndSortedPackages.length / itemsPerPage));
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredAndSortedPackages.length);

    const paginatedPackages = filteredAndSortedPackages.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusBadge = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'aktif' || s === 'diperpanjang') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 shadow-sm">Aktif</Badge>;
        if (s === 'pending' || s === 'belum_dimulai') return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 shadow-sm">Pending</Badge>;
        if (s === 'expired') return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 shadow-sm">Expired</Badge>;
        if (s === 'selesai' || s === 'habis') return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200 shadow-sm">Selesai</Badge>;
        return <Badge variant="outline">{status}</Badge>;
    };

    const PaginationControls = () => (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="hidden sm:inline">Tampilkan</span>
                <Select 
                    value={itemsPerPage.toString()} 
                    onValueChange={(val) => setItemsPerPage(Number(val))}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={itemsPerPage} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                </Select>
                <span>data per halaman</span>
            </div>
    
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 hidden sm:inline mr-2">
                    {filteredAndSortedPackages.length > 0 ? `Menampilkan ${startItem} - ${endItem} dari ${filteredAndSortedPackages.length} data` : ''}
                </span>
                <div className="flex gap-1">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 w-8 p-0" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
    
                    <div className="flex items-center gap-1 mx-1">
                        <span className="text-sm font-medium">Halaman {currentPage}</span>
                    </div>
    
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 w-8 p-0" 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Package Recaps</h1>
                    <p className="text-slate-500 text-sm mt-1">Kelola status dan riwayat paket pasien</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto shadow-sm">
                        <Plus className="w-4 h-4 mr-2" /> ➕ Tambahkan Pasien Paket
                    </Button>
                </div>
            </div>

            {/* Restructured Filter Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Search Input */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cari Pasien</Label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input 
                                    placeholder="Ketik nama pasien..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-slate-50 border-slate-300 focus:ring-2 focus:ring-blue-500 rounded-lg shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Status Dropdown */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="bg-slate-50 border-slate-300 focus:ring-2 focus:ring-blue-500 rounded-lg shadow-sm">
                                    <SelectValue placeholder="Pilih Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-slate-500" />
                                            <span>Semua</span>
                                            <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">{counts.all}</Badge>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="aktif">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span>Aktif</span>
                                            <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">{counts.aktif}</Badge>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pending">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-500" />
                                            <span>Pending / Belum Dimulai</span>
                                            <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">{counts.pending}</Badge>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="expired">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                            <span>Expired</span>
                                            <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">{counts.expired}</Badge>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="selesai">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-slate-500" />
                                            <span>Selesai</span>
                                            <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">{counts.selesai}</Badge>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Top Pagination Controls */}
            {filteredAndSortedPackages.length > 0 && <PaginationControls />}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-3 text-center">Nama Pasien</th>
                                <th className="px-4 py-3 text-center">Jenis Paket</th>
                                <th className="px-4 py-3 text-center">Sesi Terpakai</th>
                                <th className="px-4 py-3 text-center">Sisa Sesi</th>
                                <th className="px-4 py-3 text-center">Tgl Beli</th>
                                <th className="px-4 py-3 text-center">Tgl Selesai</th>
                                <th className="px-4 py-3 text-center">Sisa Hari</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={9} className="p-8 text-center text-slate-500"><Loader2 className="animate-spin w-6 h-6 mx-auto mb-2" />Memuat data...</td></tr>
                            ) : paginatedPackages.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-500">Tidak ada data paket.</td>
                                </tr>
                            ) : (
                                paginatedPackages.map((pkg) => {
                                    const sisaHari = calculateSisaHari(pkg);
                                    
                                    return (
                                        <tr 
                                            key={pkg.id} 
                                            onClick={() => handleRowClick(pkg)}
                                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-900 text-center">
                                                {pkg.patients?.full_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-center">{pkg.package_name || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {pkg.sessions_used} / {pkg.total_sessions}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                                                {pkg.sessions_remaining}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-center">
                                                {pkg.start_date ? formatDateIndonesian(pkg.start_date) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-center">
                                                {pkg.extended_until 
                                                    ? <span className="text-orange-600 font-medium">{formatDateIndonesian(pkg.extended_until)}</span>
                                                    : (pkg.end_date ? formatDateIndonesian(pkg.end_date) : '-')
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn("text-sm", getSisaHariColor(sisaHari))}>
                                                    {sisaHari !== null ? `${sisaHari} Hari` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadge(pkg.status)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    {pkg.status === 'expired' && (
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                                            onClick={(e) => handleExtendClick(e, pkg)}
                                                        >
                                                            Perpanjang
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                                        onClick={(e) => handleEditStatusClick(e, pkg)}
                                                    >
                                                        Ubah Status
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                                        onClick={(e) => handleDeleteClick(e, pkg)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
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
            
            {/* Bottom Pagination Controls */}
            {filteredAndSortedPackages.length > 0 && <PaginationControls />}

            {/* Modals */}
            <AddPackageModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                onSuccess={fetchPackages}
            />

            <ExtendPackageModal
                isOpen={isExtendModalOpen}
                onClose={() => setIsExtendModalOpen(false)}
                packageData={selectedPackage}
                onSuccess={fetchPackages}
            />

            <PackageHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                packageData={selectedPackage}
            />

            <EditPackageStatusModal
                isOpen={isEditStatusModalOpen}
                onClose={() => setIsEditStatusModalOpen(false)}
                packageData={selectedPackage}
                onSuccess={fetchPackages}
            />

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Hapus Paket</DialogTitle>
                        <DialogDescription>
                            Anda yakin ingin menghapus paket milik <b>{selectedPackage?.patients?.full_name}</b>?
                            Tindakan ini tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
};

// Admin Wrapper
const PackageRecapsAdmin = () => {
    // Admin Nav Items - Matches sorted order required by layout logic
    const adminNavItems = [
        { label: 'Dashboard', path: '/admin/dashboard', icon: 'Home' },
        { label: 'Appointments', path: '/admin/appointments', icon: 'Calendar' },
        { label: 'Daily Recaps', path: '/admin/daily-recap', icon: 'ClipboardList' },
        { label: 'Package Recaps', path: '/admin/package-recaps', icon: 'Package' },
        { label: 'Database Patients', path: '/admin/database-patients', icon: 'Database' },
        { label: 'Medical Records', path: '/admin/medical-records', icon: 'Activity' },
        { label: 'Physiotherapist Management', path: '/admin/physiotherapist-management', icon: 'Users' },
        { label: 'Follow Up Management', path: '/admin/follow-up-management', icon: 'ClipboardList' },
        { label: 'Clinical Documents', path: '/admin/clinical-documents', icon: 'FileText' },
        { label: 'Accounting System', path: '/admin/accounting', icon: 'DollarSign' }
    ];

    return (
        <DashboardLayout role="admin" navItems={adminNavItems}>
            <PackageRecapsContent />
        </DashboardLayout>
    );
};

export default PackageRecapsAdmin;