import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2, Download, Upload, CheckCircle, Loader2,
  Info, Plus, Search, RefreshCw, AlertCircle, Clock, Bug,
  Edit, Filter, Calculator, Database, MoreHorizontal,
  ArrowUp, ArrowDown,
  ArrowLeft, ArrowRight, Package as PackageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from '@/components/ui/use-toast';
import SearchableSelect from '@/components/ui/searchable-select';
import { downloadCSV, formatPackageData, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { getAllPackageTrackings, getPatients, getOperationalOptions, createPackageTracking, getDailyRecaps, recalculateAllPackageUsage, updatePackageStatusAutomatically, deletePackageTracking } from '@/lib/api';
import EditPackageStatusModal from '@/components/admin/EditPackageStatusModal';
import EditPackageSessionModal from '@/components/admin/EditPackageSessionModal';
import DebugPackagePanel from '@/components/admin/DebugPackagePanel'; 
import ImportPackageCSVModal from '@/components/owner/ImportPackageCSVModal';
import PackageHistoryModal from '@/components/shared/PackageHistoryModal';
import DeletePackageConfirmationModal from '@/components/admin/DeletePackageConfirmationModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const normalizePackageStatus = (status) => {
  if (!status) return status;
  const s = status.toLowerCase();

  if (s === 'habis') return 'selesai';
  return s;
};

const OwnerPackageRecap = () => {
  const { toast } = useToast();
  const { role } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: 'end_date',
    direction: 'asc'
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [packageTypes, setPackageTypes] = useState([]);
  const [patients, setPatients] = useState([]);
  
  // Modals & Panels State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSessionModalOpen, setEditSessionModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // History Modal
  const [sessionHistoryModalOpen, setSessionHistoryModalOpen] = useState(false);

  // Manual Input State
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualForm, setManualForm] = useState({
    patient_id: '',
    package_type_id: '',
    start_date: new Date().toISOString().split('T')[0],
    validity_days: 30,
    sessions_used: 0,
    sessions_remaining: 5,
    nominal: 0
  });

  const canViewHistory = role === 'admin' || role === 'owner' || role === 'super_admin';

  useEffect(() => { fetchFormData(); }, []);
  useEffect(() => { fetchPackageHistory(); }, [refreshTrigger]);

  const fetchFormData = async () => {
    try {
        const [patientsRes, pkgTypeRes] = await Promise.all([ getPatients(), getOperationalOptions('tipe_paket') ]);
        if (patientsRes?.data) setPatients(patientsRes.data);
        if (pkgTypeRes?.data) setPackageTypes(pkgTypeRes.data);
    } catch (err) {}
  };

  const fetchPackageHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      await recalculateAllPackageUsage();
      // Fetch data
      const [trackingsRes, recapsRes, optionsRes] = await Promise.all([
          getAllPackageTrackings(),
          getDailyRecaps({ limit: 'all' }), 
          getOperationalOptions('tipe_paket')
      ]);
      
      if (trackingsRes.error) throw trackingsRes.error;
      if (recapsRes.error) throw recapsRes.error;
      
      const rawTrackings = trackingsRes.data || [];
      const rawRecaps = recapsRes.data || [];
      const packageDefinitions = optionsRes.data || [];
      
      const processed = rawTrackings.map(pkg => {
        const formatted = formatPackageData(pkg, rawRecaps, packageDefinitions);
          formatted.patient = pkg.patient;
          
          formatted.computed_sessions_used = pkg.sessions_used || 0;
          formatted.computed_sessions_remaining = pkg.sessions_remaining || 0;
          formatted.computed_total_sessions = pkg.total_sessions || 0;
          
        formatted.computed_status = normalizePackageStatus(pkg.status);
          
          formatted.sessions_used = pkg.sessions_used;
          
          return formatted;
      });

      setData(processed);
    } catch (err) { 
        console.error(err);
        setError("Gagal memuat data riwayat paket."); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
        const result = await recalculateAllPackageUsage();
        if (result.error) throw result.error;
        
        toast({ 
            title: "Sinkronisasi Berhasil", 
            description: `Data paket telah diperbarui. ${result.updated} paket disesuaikan.` 
        });
        setRefreshTrigger(prev => prev + 1);
    } catch (error) {
        toast({ 
            variant: "destructive", 
            title: "Gagal Sinkronisasi", 
            description: error.message 
        });
    } finally {
        setIsSyncing(false);
    }
  };

  const handleManualStatusUpdate = async (e, pkgId) => {
    e.stopPropagation();
    setUpdatingStatusId(pkgId);
    try {
        const result = await updatePackageStatusAutomatically(pkgId);
        if (result.error) throw result.error;

        toast({
            title: "Status Diperbarui",
            description: "Status paket berhasil dihitung ulang.",
        });

        // Update local state directly to reflect changes immediately
        setData(prevData => prevData.map(pkg => {
            if (pkg.id === pkgId) {
                return {
                    ...pkg,
                    sessions_used: result.data.sessions_used,
                    sessions_remaining: result.data.sessions_remaining,
                    status: result.data.status,
                    computed_sessions_used: result.data.sessions_used,
                    computed_sessions_remaining: result.data.sessions_remaining,
                    computed_status: result.data.status,
                    sessions_used: result.data.sessions_used
                };
            }
            return pkg;
        }));

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Gagal Update Status",
            description: error.message
        });
    } finally {
        setUpdatingStatusId(null);
    }
  };

  // Sorting Logic
  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Sisa Hari Calculation
  const calculateSisaHari = (item) => {
    const status = (item.computed_status || '').toLowerCase();
    const isActive = status === 'aktif' || status === 'diperpanjang' || status === 'active';
    
    if (!isActive) return null;

    const endDate = status === 'diperpanjang' && item.extended_until 
        ? new Date(item.extended_until) 
        : new Date(item.end_date);
    
    if (isNaN(endDate.getTime())) return null;

    // Normalize to start of day for accurate day diff
    const today = new Date();
    today.setHours(0,0,0,0);
    endDate.setHours(0,0,0,0);

    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const getSisaHariColor = (days) => {
    if (days === null) return '';
    if (days <= 0) return 'bg-red-100 text-red-800 border-red-200';
    if (days <= 7) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const statusCounts = useMemo(() => {
    const getCount = (statusKey) => {
         return data.filter(pkg => {
            const s = (pkg.computed_status || '').toLowerCase().trim();
            if (statusKey === 'Semua') return true;
            if (statusKey === 'Aktif') return s === 'aktif' || s === 'active';
            if (statusKey === 'Selesai') return ['selesai', 'habis', 'completed', 'done'].includes(s);
            if (statusKey === 'Expired') return s === 'expired';
            if (statusKey === 'Diperpanjang') return s === 'diperpanjang';
            if (statusKey === 'Belum Dimulai') return s === 'pending';
            return s === statusKey.toLowerCase();
         }).length;
    };

    return {
      'Semua': getCount('Semua'),
      'Aktif': getCount('Aktif'),
      'Selesai': getCount('Selesai'),
      'Expired': getCount('Expired'),
      'Diperpanjang': getCount('Diperpanjang'),
      'Belum Dimulai': getCount('Belum Dimulai')
    };
  }, [data]);

  const filteredHistory = useMemo(() => {
    let result = [...data];

    // SEARCH
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(pkg =>
        (pkg.patient_name || '').toLowerCase().includes(q) ||
        (pkg.medical_record_number || '').toLowerCase().includes(q) ||
        pkg.package_name?.toLowerCase().includes(q)
        );
    }

    // STATUS FILTER
    // Comprehensive filtering for 'Selesai' and other statuses
    if (statusFilter !== 'Semua') {
        result = result.filter(pkg => {
            const s = (pkg.computed_status || '').toLowerCase().trim();
            
            if (statusFilter === 'Aktif') return s === 'aktif' || s === 'active';
            
            // Handle multiple variations of "Selesai"
            if (statusFilter === 'Selesai') {
                return ['selesai', 'habis', 'completed', 'done'].includes(s);
            }
            
            if (statusFilter === 'Expired') return s === 'expired';
            if (statusFilter === 'Diperpanjang') return s === 'diperpanjang';
            if (statusFilter === 'Belum Dimulai') return s === 'pending';
            
            return s === statusFilter.toLowerCase();
        });
    }

    // SORTING
    return [...result].sort((a, b) => {
        let aVal, bVal;

        switch (sortConfig.key) {
        case 'end_date': {
            const aActive = a.computed_status === 'aktif' || a.computed_status === 'active';
            const bActive = b.computed_status === 'aktif' || b.computed_status === 'active';

            if (aActive !== bActive) return aActive ? -1 : 1;

            // Use extended date if applicable
            const dateA = a.computed_status === 'diperpanjang' && a.extended_until ? a.extended_until : a.end_date;
            const dateB = b.computed_status === 'diperpanjang' && b.extended_until ? b.extended_until : b.end_date;

            aVal = dateA ? new Date(dateA).getTime() : Infinity;
            bVal = dateB ? new Date(dateB).getTime() : Infinity;
            break;
        }
        default:
            aVal = 0;
            bVal = 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [data, searchQuery, statusFilter, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortConfig, itemsPerPage]);

  // ===============================
  // PAGINATION DERIVED STATE
  // ===============================
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredHistory.length);

  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase();

    if (s === 'aktif') {
      return (
        <Badge className="bg-green-100 text-green-800 border-transparent hover:bg-green-200 font-medium">
          <CheckCircle className="w-3 h-3 mr-1" /> Aktif
        </Badge>
      );
    }

    if (s === 'diperpanjang') {
      return (
        <Badge className="bg-purple-100 text-purple-800 border-transparent hover:bg-purple-200 font-medium">
          <Clock className="w-3 h-3 mr-1" /> Diperpanjang
        </Badge>
      );
    }

    if (s === 'selesai' || s === 'habis' || s === 'completed' || s === 'done') {
      return (
        <Badge className="bg-slate-100 text-slate-800 border-transparent hover:bg-slate-200 font-medium">
          <CheckCircle className="w-3 h-3 mr-1" /> Selesai
        </Badge>
      );
    }

    if (s === 'pending') {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-transparent hover:bg-blue-200 font-medium">
          Belum Dimulai
        </Badge>
      );
    }

    if (s === 'expired') {
      return (
        <Badge className="bg-red-100 text-red-800 border-transparent hover:bg-red-200 font-medium">
          <AlertCircle className="w-3 h-3 mr-1" /> Expired
        </Badge>
      );
    }

    return <Badge variant="outline">{status}</Badge>;
  };


  const handleManualSubmit = async () => {
    if (!manualForm.patient_id || !manualForm.package_type_id) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama Pasien dan Jenis Paket wajib diisi." });
      return;
    }

    const totalSessions = parseInt(manualForm.sessions_used || 0) + parseInt(manualForm.sessions_remaining || 0);

    if (totalSessions <= 0) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Total sesi harus lebih dari 0." });
      return;
    }

    setManualLoading(true);

    try {
      const selectedPkg = packageTypes.find(p => p.id === manualForm.package_type_id);

      const payload = {
        patient_id: manualForm.patient_id,
        package_type_id: manualForm.package_type_id,
        package_name: selectedPkg?.label || 'Unknown Package',
        start_date: manualForm.start_date,
        end_date: null,
        validity_days: parseInt(manualForm.validity_days) || null,
        sessions_used: 0,
        sessions_remaining: totalSessions,
        total_sessions: totalSessions,
        status: 'pending',
        nominal: Number(manualForm.nominal) || 0
      };

      const { error } = await createPackageTracking(payload);
      if (error) throw error;

      toast({ title: "Berhasil", description: "Paket berhasil dicatat (belum dimulai)." });

      setManualDialogOpen(false);
      setRefreshTrigger(p => p + 1);

      setManualForm({
        patient_id: '',
        package_type_id: '',
        start_date: new Date().toISOString().split('T')[0],
        validity_days: 30,
        sessions_used: 0,
        sessions_remaining: 5,
        status: 'pending',
        nominal: 0
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal Simpan", description: err.message });
    } finally {
      setManualLoading(false);
    }
  };


  const handleExport = () => {
      const exportData = filteredHistory.map(p => ({
        'Patient': p.patient_name || 'Nama tidak tersedia',
        'RM': p.medical_record_number || '-',
          'Package': p.package_name,
          'Start': p.formatted_start_date,
          'End': p.computed_status === 'diperpanjang' && p.extended_until ? format(new Date(p.extended_until), 'dd MMM yyyy', {locale: id}) : p.formatted_end_date,
        'Status': normalizePackageStatus(p.computed_status),
          'Used': p.computed_sessions_used,
          'Total': p.computed_total_sessions
      }));
      downloadCSV(exportData, 'package_history_export.csv');
  };

  const patientOptions = patients.filter(p => p).map(p => ({ value: p.id, label: `${p.full_name || 'Unknown'} (${p.medical_record_number || '-'})` }));
  const packageTypeOptions = packageTypes.map(p => ({ value: p.id, label: p.label }));

  const openEditModal = (e, pkg) => {
      e.stopPropagation(); 
      setSelectedPackage(pkg);
      setEditModalOpen(true);
  };
  
  const openSessionModal = (e, pkg) => {
      e.stopPropagation();
      setSelectedPackage(pkg);
      setEditSessionModalOpen(true);
  };

  const handleDeleteClick = (e, pkg) => {
      e.stopPropagation();
      setSelectedPackage(pkg);
      setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPackage) return;
    setIsDeleting(true);
    try {
        const { error } = await deletePackageTracking(selectedPackage.id);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Paket telah dihapus." });
        setRefreshTrigger(prev => prev + 1);
        setDeleteModalOpen(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Gagal menghapus", description: error.message });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleRowClick = (pkg) => {
      if (canViewHistory) {
          setSelectedPackage(pkg);
          setSessionHistoryModalOpen(true);
      }
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ArrowUp className="ml-1 h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600" />;
  };

  const ThSortable = ({ column, label, className = "" }) => (
    <TableHead 
        className={cn(
            "cursor-pointer hover:bg-slate-100 transition-colors select-none group font-semibold text-slate-900 sticky top-0 bg-slate-50 border-b-2 border-slate-200", 
            sortConfig.key === column ? "bg-slate-100" : "",
            className
        )}
        onClick={() => handleSort(column)}
    >
        <div
  className={cn(
    "flex items-center w-full",
    className.includes("text-center")
      ? "justify-center"
      : className.includes("text-right")
      ? "justify-end"
      : "justify-start"
  )}
>
            {label}
            <SortIcon column={column} />
        </div>
    </TableHead>
  );

  const PaginationControls = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
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
                {filteredHistory.length > 0 ? `Menampilkan ${startItem} - ${endItem} dari ${filteredHistory.length} data` : ''}
            </span>
            <div className="flex gap-1">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 w-8 p-0 border-slate-300 hover:bg-slate-50" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1 mx-1">
                    <span className="text-sm font-medium px-2">Halaman {currentPage}</span>
                </div>

                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 w-8 p-0 border-slate-300 hover:bg-slate-50" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 space-y-4 xl:space-y-0">
        
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium" onClick={() => setManualDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Manual
          </Button>
          <Button variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50 font-medium" onClick={() => setImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2 text-green-600" /> Import CSV
          </Button>
          <Button variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50 font-medium" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2 text-blue-600" /> Export CSV
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
             {/* Status Filter Dropdown */}
             <div className="w-full sm:w-48">
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                     <SelectTrigger className="w-full border-slate-300 h-10">
                         <Filter className="w-3.5 h-3.5 mr-2 text-slate-500" />
                         <SelectValue placeholder="Filter Status" />
                     </SelectTrigger>
                     <SelectContent>
                {['Semua', 'Aktif', 'Selesai', 'Expired', 'Diperpanjang', 'Belum Dimulai'].map(status => (
                             <SelectItem key={status} value={status} className="flex justify-between w-full">
                                 <span>{status}</span>
                                 <Badge variant="secondary" className="ml-2 text-xs h-5 px-1.5">{statusCounts[status] || 0}</Badge>
                             </SelectItem>
                         ))}
                     </SelectContent>
                 </Select>
             </div>
             
             {/* Debug Toggle */}
             <Button 
                variant={showDebug ? "secondary" : "outline"} 
                className={`text-slate-600 h-10 ${showDebug ? 'bg-amber-100 text-amber-800 border-amber-200' : 'border-slate-300 hover:bg-slate-50'}`}
                onClick={() => setShowDebug(!showDebug)}
             >
                <Bug className="w-4 h-4 mr-2" /> {showDebug ? 'Hide Debug' : 'Debug Mode'}
             </Button>
             
             <Button variant="destructive" className="hidden sm:flex h-10 bg-red-600 hover:bg-red-700">
                 <Trash2 className="w-4 h-4 mr-2" /> Hapus Masal
             </Button>
        </div>

      </div>

      {/* Debug Panel */}
      {showDebug && (
          <div className="animate-in slide-in-from-top-4 duration-300">
             <DebugPackagePanel />
          </div>
      )}
      
      {/* Package History View */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">📦 Riwayat Paket Pasien</h2>
            <p className="text-slate-500 text-sm mt-1">Data paket pasien terdaftar. Klik baris untuk detail.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                    placeholder="Cari..." 
                    className="pl-9 h-10 border-slate-300 focus:ring-blue-500" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             
             <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSyncData} 
                disabled={isSyncing || loading}
                className="gap-2 text-blue-600 border-slate-300 hover:bg-blue-50 h-10"
             >
                <Database className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Data'}
             </Button>

             <Button variant="outline" size="icon" onClick={() => { setRefreshTrigger(prev => prev + 1); }} disabled={loading} title="Refresh Data" className="h-10 w-10 border-slate-300 hover:bg-slate-50">
                <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
             </Button>
          </div>
        </div>
        
        {/* Top Pagination Controls */}
        {filteredHistory.length > 0 && <PaginationControls />}

        {error ? (
            <div className="p-12 text-center text-red-500 bg-red-50">
                <AlertCircle className="w-8 h-8 mx-auto mb-2"/>
                <p>{error}</p>
            </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <ThSortable column="patient_name" label="PASIEN" className="pl-6 py-4 font-semibold text-slate-900 sticky top-0 bg-slate-50 border-b-2 border-slate-200" />
                  <ThSortable column="package_name" label="JENIS PAKET" className="py-4 font-semibold text-slate-900 sticky top-0 bg-slate-50 border-b-2 border-slate-200" />
                  <ThSortable column="start_date" label="TANGGAL BELI" className="py-4 font-semibold text-slate-900 sticky top-0 bg-slate-50 border-b-2 border-slate-200" />
                  <ThSortable column="end_date" label="TANGGAL SELESAI" className="py-4 font-semibold text-slate-900 sticky top-0 bg-slate-50 border-b-2 border-slate-200" />
                  <ThSortable column="sessions_used" label="TERPAKAI" className="text-center py-4 font-semibold text-slate-900 sticky top-0 bg-slate-50 border-b-2 border-slate-200" />
                  <TableHead className="font-semibold text-slate-900 text-center py-4 sticky top-0 bg-slate-50 border-b-2 border-slate-200">SISA HARI</TableHead>
                  <ThSortable column="status" label="STATUS" className="py-4 font-semibold text-slate-900 sticky top-0 bg-slate-50 border-b-2 border-slate-200" />
                  <TableHead className="font-semibold text-slate-900 text-right pr-6 py-4 sticky top-0 bg-slate-50 border-b-2 border-slate-200">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={8} className="h-48 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
                ) : filteredHistory.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={8} className="h-64 text-center">
                             <div className="flex flex-col items-center justify-center text-slate-500">
                                  <PackageIcon className="w-12 h-12 mb-3 text-slate-300" />
                                  <h3 className="text-lg font-medium text-slate-900">Belum ada riwayat paket</h3>
                                  <p className="text-sm mt-1">Data paket akan muncul di sini.</p>
                              </div>
                        </TableCell>
                    </TableRow>
                ) : (
                        paginatedHistory.map((pkg, index) => {
                          const displayEndDate = pkg.computed_status === 'diperpanjang' && pkg.extended_until 
                            ? pkg.extended_until 
                            : pkg.end_date;

                          const sisaHari = calculateSisaHari(pkg);
                          const sisaHariClass = getSisaHariColor(sisaHari);

                          return (
                            <TableRow 
                                key={pkg.id} 
                                className={cn(
                                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                                  "transition-colors border-b border-slate-100 last:border-0 hover:bg-slate-100",
                                  canViewHistory ? "cursor-pointer" : "cursor-default"
                                )}
                                onClick={() => handleRowClick(pkg)}
                            >
                              <TableCell className="pl-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">
  {pkg.patient_name || 'Nama tidak tersedia'}
</span>
<span className="text-xs text-slate-500 font-mono mt-0.5">
  {pkg.medical_record_number || '-'}
</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-slate-700 py-4">{pkg.package_name}</TableCell>
                              <TableCell className="text-sm text-slate-600 py-4 font-mono">{pkg.formatted_start_date}</TableCell>
                          <TableCell className="text-center py-4">
                              <span className="text-sm text-slate-600 font-mono">
                                {displayEndDate ? format(new Date(displayEndDate), 'dd MMM yyyy', { locale: id }) : '-'}
                              </span>
                          </TableCell>
                              <TableCell className="text-center py-4">
                                 <div className="inline-flex items-center justify-center bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                    <span className="font-bold text-slate-700 text-xs">{pkg.computed_sessions_used}</span>
                                    <span className="text-slate-400 mx-1 text-xs">/</span>
                                    <span className="text-slate-500 text-xs">{pkg.computed_total_sessions}</span>
                                 </div>
                              </TableCell>
                              
                              <TableCell className="text-center py-4">
                                {sisaHari !== null ? (
                                    <Badge variant="outline" className={cn("font-medium", sisaHariClass)}>
                                        {sisaHari} Hari
                                    </Badge>
                                ) : (
                                    <span className="text-slate-400">-</span>
                                )}
                              </TableCell>

                              <TableCell className="py-4">{getStatusBadge(pkg.computed_status)}</TableCell>
                              <TableCell className="text-right pr-6 py-4">
                                <div className="flex justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => handleManualStatusUpdate(e, pkg.id)}
                                        className="h-8 w-8 p-0 hover:bg-slate-200 rounded-full"
                                        title="Hitung Ulang Status"
                                        disabled={updatingStatusId === pkg.id}
                                    >
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${updatingStatusId === pkg.id ? 'animate-spin text-blue-600' : ''}`} />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={(e) => openSessionModal(e, pkg)} 
                                        className="h-8 w-8 p-0 hover:bg-slate-200 rounded-full"
                                        title="Edit Sesi"
                                    >
                                        <Calculator className="w-4 h-4 text-slate-500" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={(e) => openEditModal(e, pkg)} 
                                        className="h-8 w-8 p-0 hover:bg-slate-200 rounded-full"
                                        title="Edit Status"
                                    >
                                        <Edit className="w-4 h-4 text-slate-500" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={(e) => handleDeleteClick(e, pkg)} 
                                        className="h-8 w-8 p-0 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-full"
                                        title="Hapus Paket"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                         );
                    })
                )}
              </TableBody>
              </Table>
              {/* Bottom Pagination Controls */}
              {filteredHistory.length > 0 && <PaginationControls />}

          </div>
        )}
      </div>

      {/* Manual Input Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
         <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader><DialogTitle className="text-xl font-bold">Input Data Paket Manual</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2"><label className="text-xs uppercase font-medium text-slate-500">Pasien</label><SearchableSelect options={patientOptions} value={manualForm.patient_id} onChange={(val) => setManualForm({...manualForm, patient_id: val})} placeholder="Cari Pasien..." /></div>
                <div className="space-y-2"><label className="text-xs uppercase font-medium text-slate-500">Paket</label><SearchableSelect options={packageTypeOptions} value={manualForm.package_type_id} onChange={(val) => setManualForm({...manualForm, package_type_id: val})} placeholder="Pilih Paket..." /></div>
                
                <div className="space-y-2">
                    <label className="text-xs uppercase font-medium text-slate-500">Nominal Paket (Rp)</label>
                    <Input 
                        type="number" 
                        placeholder="Contoh: 500000" 
                        value={manualForm.nominal} 
                        onChange={(e) => setManualForm({...manualForm, nominal: e.target.value})} 
                        min="0"
                        className="bg-white border-slate-300"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4"><Input type="date" value={manualForm.start_date} onChange={(e) => setManualForm({...manualForm, start_date: e.target.value})} className="bg-white border-slate-300" /><Input type="number" placeholder="Hari Berlaku" value={manualForm.validity_days} onChange={(e) => setManualForm({...manualForm, validity_days: e.target.value})} className="bg-white border-slate-300" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <Input type="number" placeholder="Used Sessions" value={manualForm.sessions_used} onChange={(e) => setManualForm({...manualForm, sessions_used: e.target.value})} className="bg-white border-slate-300" />
                    <Input type="number" placeholder="Remaining Sessions" value={manualForm.sessions_remaining} onChange={(e) => setManualForm({...manualForm, sessions_remaining: e.target.value})} className="bg-white border-slate-300" />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setManualDialogOpen(false)} className="border-slate-300">Batal</Button>
                <Button onClick={handleManualSubmit} disabled={manualLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {manualLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Simpan
                </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Modals */}
      <EditPackageStatusModal 
        isOpen={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        packageData={selectedPackage} 
        onSuccess={() => {
            setRefreshTrigger(prev => prev + 1);
            setEditModalOpen(false);
        }} 
      />

      <EditPackageSessionModal 
        isOpen={editSessionModalOpen} 
        onClose={() => setEditSessionModalOpen(false)} 
        packageData={selectedPackage} 
        onSuccess={() => {
            setRefreshTrigger(prev => prev + 1);
            setEditSessionModalOpen(false);
        }} 
      />

      <ImportPackageCSVModal 
        isOpen={importModalOpen} 
        onClose={() => setImportModalOpen(false)} 
        onSuccess={() => {
            setRefreshTrigger(prev => prev + 1);
            setImportModalOpen(false);
        }} 
      />

      <DeletePackageConfirmationModal 
        isOpen={deleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)} 
        onConfirm={handleConfirmDelete} 
        isDeleting={isDeleting} 
        packageName={selectedPackage?.package_name} 
        patientName={selectedPackage?.patient_name} 
      />

      <PackageHistoryModal 
        isOpen={sessionHistoryModalOpen} 
        onClose={() => setSessionHistoryModalOpen(false)} 
        packageData={selectedPackage} 
      />

    </div>
  );
};

export default OwnerPackageRecap;