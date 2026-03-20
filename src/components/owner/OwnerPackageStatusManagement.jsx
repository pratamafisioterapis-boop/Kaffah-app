import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, RefreshCw, MoreHorizontal, Edit, Trash2, 
  Eye, Download, CheckSquare, Square, AlertTriangle, 
  Calendar, CheckCircle, Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatPackageData, downloadCSV } from '@/lib/utils';
import { format, isBefore, startOfDay, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import EditPackageStatusModal from '@/components/admin/EditPackageStatusModal';

const OwnerPackageStatusManagement = () => {
  const { toast } = useToast();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'start_date', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Bulk Action States
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('aktif');
  const [processingBulk, setProcessingBulk] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch packages with patient details
      const { data: pkgData, error: pkgError } = await supabase
        .from('package_tracking')
        .select('*, patient:patients(full_name, rm_number)')
        .order('created_at', { ascending: false });

      if (pkgError) throw pkgError;

      // Fetch ALL recaps for accurate calculation (this might be heavy, but necessary for "comprehensive" global view)
      // Optimization: Fetch only necessary fields
      const { data: recapData, error: recapError } = await supabase
        .from('daily_recaps')
        .select('id, patient_id, package_type, recap_date, amount, patient:patients(full_name)');

      if (recapError) throw recapError;

      // Process data with calculations
      const processed = pkgData.map(pkg => formatPackageData(pkg, recapData || []));
      setPackages(processed);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching package data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load package data."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter and Sort
  const filteredPackages = useMemo(() => {
    let data = [...packages];

    // Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(pkg => 
        pkg.patient?.full_name?.toLowerCase().includes(lowerTerm) ||
        pkg.package_name?.toLowerCase().includes(lowerTerm) ||
        pkg.status?.toLowerCase().includes(lowerTerm)
      );
    }

    // Sort
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle computed fields
        if (sortConfig.key === 'sessions_used') {
          aVal = a.computed_sessions_used;
          bVal = b.computed_sessions_used;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [packages, searchTerm, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(filteredPackages.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleDelete = async (idsToDelete) => {
    if (!idsToDelete.length) return;
    
    // If single delete, confirm
    if (idsToDelete.length === 1 && !window.confirm("Are you sure you want to delete this package record?")) return;

    setProcessingBulk(true);
    try {
        const { error } = await supabase
            .from('package_tracking')
            .delete()
            .in('id', idsToDelete);

        if (error) throw error;

        toast({
            title: "Success",
            description: `Deleted ${idsToDelete.length} package(s).`
        });
        fetchData();
        setBulkDeleteDialogOpen(false);
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Delete Failed",
            description: error.message
        });
    } finally {
        setProcessingBulk(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!selectedIds.length) return;

    setProcessingBulk(true);
    try {
        const { error } = await supabase
            .from('package_tracking')
            .update({ status: bulkStatusValue, updated_at: new Date().toISOString() })
            .in('id', selectedIds);

        if (error) throw error;

        toast({ title: "Success", description: "Updated status for selected packages." });
        fetchData();
        setBulkStatusOpen(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
        setProcessingBulk(false);
    }
  };

  const handleExport = () => {
    const exportData = filteredPackages.map(p => ({
        'Patient Name': p.patient?.full_name,
        'RM Number': p.patient?.rm_number,
        'Package Name': p.package_name,
        'Start Date': p.formatted_start_date,
        'End Date': p.computed_status === 'diperpanjang' && p.extended_until ? format(new Date(p.extended_until), 'dd MMM yyyy', {locale: id}) : p.formatted_end_date,
        'Sessions Used': p.computed_sessions_used,
        'Total Sessions': p.computed_total_sessions,
        'Remaining': p.computed_sessions_remaining,
        'Status': p.computed_status
    }));
    downloadCSV(exportData, `package_status_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  // Render Helpers
  const getStatusBadge = (status, endDate) => {
    const isExpired = endDate && isBefore(new Date(endDate), startOfDay(new Date()));
    
    if (status === 'aktif' && isExpired) {
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Expired</Badge>;
    }

    switch (status?.toLowerCase()) {
        case 'aktif': return <Badge className="bg-green-600 hover:bg-green-700">Aktif</Badge>;
        case 'selesai': return <Badge variant="secondary">Selesai</Badge>;
        case 'expired': return <Badge variant="destructive">Expired</Badge>;
        case 'diperpanjang': return <Badge className="bg-blue-600 hover:bg-blue-700">Diperpanjang</Badge>;
        case 'belum dimulai': return <Badge variant="outline" className="border-slate-400 text-slate-500">Belum Dimulai</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProgressColor = (ratio) => {
    if (ratio >= 1) return 'bg-slate-500'; // Full
    if (ratio > 0.8) return 'bg-red-500';
    if (ratio > 0.5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Cari pasien atau paket..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2">
            <span className="text-sm font-medium pl-2">{selectedIds.length} paket dipilih</span>
            <div className="flex gap-2">
                <Button 
                    size="sm" 
                    variant="secondary" 
                    className="text-slate-900"
                    onClick={() => setBulkStatusOpen(true)}
                >
                    <Edit className="w-4 h-4 mr-2" />
                    Ubah Status
                </Button>
                <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => setBulkDeleteDialogOpen(true)}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus
                </Button>
            </div>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={filteredPackages.length > 0 && selectedIds.length === filteredPackages.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('patient')}>
                Pasien
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('package_name')}>
                Paket
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('start_date')}>
                Tanggal
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('sessions_used')}>
                Progress
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                Status
              </TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500">
                            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                            <p>Loading package data...</p>
                        </div>
                    </TableCell>
                </TableRow>
            ) : filteredPackages.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-slate-500 italic">
                        Tidak ada data paket ditemukan.
                    </TableCell>
                </TableRow>
            ) : (
                filteredPackages.map((pkg) => {
                    const progress = pkg.computed_total_sessions > 0 
                        ? (pkg.computed_sessions_used / pkg.computed_total_sessions) * 100 
                        : 0;
                    
                    const displayEndDate = pkg.computed_status === 'diperpanjang' && pkg.extended_until 
                        ? pkg.extended_until 
                        : pkg.end_date;

                    return (
                        <TableRow key={pkg.id} className="hover:bg-slate-50/50">
                            <TableCell>
                                <Checkbox 
                                    checked={selectedIds.includes(pkg.id)}
                                    onCheckedChange={(checked) => handleSelectOne(pkg.id, checked)}
                                />
                            </TableCell>
                            <TableCell>
                                <div className="font-medium text-slate-900">{pkg.patient?.full_name}</div>
                                <div className="text-xs text-slate-500 font-mono">{pkg.patient?.rm_number}</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm">{pkg.package_name}</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-xs space-y-1">
                                    <div className="flex items-center text-slate-600">
                                        <Calendar className="w-3 h-3 mr-1" /> 
                                        {pkg.formatted_start_date}
                                    </div>
                                    <div className="flex items-center text-slate-400">
                                        <Clock className="w-3 h-3 mr-1" /> 
                                        {displayEndDate ? format(new Date(displayEndDate), 'dd MMM yyyy', { locale: id }) : '-'}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="w-[180px]">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="space-y-1 cursor-help">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-medium">{pkg.computed_sessions_used} / {pkg.computed_total_sessions}</span>
                                                    <span className="text-slate-500">{pkg.computed_sessions_remaining} sisa</span>
                                                </div>
                                                <Progress value={progress} className="h-2" indicatorClassName={getProgressColor(progress / 100)} />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Terpakai: {pkg.computed_sessions_used}</p>
                                            <p>Total: {pkg.computed_total_sessions}</p>
                                            <p>Sisa: {pkg.computed_sessions_remaining}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                            <TableCell>
                                {getStatusBadge(pkg.computed_status, pkg.end_date)}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => { setSelectedPackage(pkg); setDetailModalOpen(true); }}>
                                            <Eye className="mr-2 h-4 w-4" /> Detail
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { setSelectedPackage(pkg); setEditModalOpen(true); }}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit Status
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            className="text-red-600 focus:text-red-600"
                                            onClick={() => handleDelete([pkg.id])}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Status Modal */}
      <EditPackageStatusModal 
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        packageData={selectedPackage}
        onSuccess={fetchData}
      />

      {/* View Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Detail Paket</DialogTitle>
            </DialogHeader>
            {selectedPackage && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-50 p-3 rounded">
                            <span className="text-slate-500 block text-xs">Pasien</span>
                            <span className="font-medium">{selectedPackage.patient?.full_name}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded">
                            <span className="text-slate-500 block text-xs">Paket</span>
                            <span className="font-medium">{selectedPackage.package_name}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded">
                            <span className="text-slate-500 block text-xs">Status Saat Ini</span>
                            <span className="font-medium capitalize">{selectedPackage.computed_status}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded">
                            <span className="text-slate-500 block text-xs">Masa Berlaku</span>
                            <span className="font-medium">
                                {selectedPackage.computed_status === 'diperpanjang' && selectedPackage.extended_until 
                                    ? format(new Date(selectedPackage.extended_until), 'dd MMM yyyy', {locale: id})
                                    : selectedPackage.formatted_end_date}
                            </span>
                        </div>
                    </div>
                    
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-2">Statistik Penggunaan</h4>
                        <div className="space-y-2">
                             <div className="flex justify-between text-sm">
                                <span>Total Sesi:</span>
                                <span className="font-mono">{selectedPackage.computed_total_sessions}</span>
                             </div>
                             <div className="flex justify-between text-sm">
                                <span>Terpakai:</span>
                                <span className="font-mono">{selectedPackage.computed_sessions_used}</span>
                             </div>
                             <div className="flex justify-between text-sm font-bold text-slate-700 pt-1 border-t">
                                <span>Sisa:</span>
                                <span className="font-mono">{selectedPackage.computed_sessions_remaining}</span>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
         <DialogContent>
            <DialogHeader>
                <DialogTitle>Konfirmasi Hapus Massal</DialogTitle>
                <DialogDescription>
                    Anda akan menghapus {selectedIds.length} paket yang dipilih. Tindakan ini tidak dapat dibatalkan.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setBulkDeleteDialogOpen(false)}>Batal</Button>
                <Button variant="destructive" onClick={() => handleDelete(selectedIds)} disabled={processingBulk}>
                    {processingBulk ? "Menghapus..." : "Ya, Hapus Semua"}
                </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

       {/* Bulk Status Dialog */}
       <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
         <DialogContent>
            <DialogHeader>
                <DialogTitle>Update Status Massal</DialogTitle>
                <DialogDescription>
                    Pilih status baru untuk {selectedIds.length} paket yang dipilih.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih status..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="aktif">Aktif</SelectItem>
                        <SelectItem value="selesai">Selesai</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="diperpanjang">Diperpanjang</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setBulkStatusOpen(false)}>Batal</Button>
                <Button onClick={handleBulkStatusUpdate} disabled={processingBulk}>
                    {processingBulk ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

    </div>
  );
};

export default OwnerPackageStatusManagement;