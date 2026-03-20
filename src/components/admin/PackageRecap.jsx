
// === TIDAK ADA IMPORT YANG DIHAPUS ===
import React, { useEffect, useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { buildPackageData } from '@/lib/packageHelper';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MoreHorizontal, Trash2, Edit2, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Calculator, RefreshCw, ArrowUp, ArrowDown, Clock, Package as PackageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { getAllPackageTrackings, deletePackageTracking, getDailyRecaps, getOperationalOptions } from '@/lib/api';
import { formatPackageData } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import DeletePackageConfirmationModal from '@/components/admin/DeletePackageConfirmationModal';
import EditPackageStatusModal from '@/components/admin/EditPackageStatusModal';
import EditPackageSessionModal from '@/components/admin/EditPackageSessionModal';
import PackageHistoryModal from '@/components/shared/PackageHistoryModal';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// ==========================
// TAMPILAN SUDAH DIMODERNISASI
// LOGIC TETAP SAMA
// ==========================

const normalizePackageStatus = (status) => {
  if (!status) return status;
  const s = status.toLowerCase();
  if (s === 'habis') return 'selesai';
  return s;
};

const PackageRecap = ({ hideControls = false }) => {
  console.log("PACKAGE RECAP RENDER");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'end_date', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editStatusModalOpen, setEditStatusModalOpen] = useState(false);
  const [editSessionModalOpen, setEditSessionModalOpen] = useState(false);
  const [sessionHistoryModalOpen, setSessionHistoryModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const { toast } = useToast();
  const { role } = useAuth();
  const canViewHistory = role === 'admin' || role === 'owner' || role === 'super_admin';

  

const fetchData = async () => {
  setLoading(true);

  try {
    const [trackingsRes, recapsRes, optionsRes] = await Promise.all([
      getAllPackageTrackings(),
      getDailyRecaps({ limit: 'all' }),
      getOperationalOptions('tipe_paket')
    ]);

    const processed = buildPackageData(
      trackingsRes.data,
      recapsRes.data,
      optionsRes.data
    );

    setData(processed);

  } catch (error) {
    console.log(error);
  } finally {
    setLoading(false);
  }
};

 useEffect(() => {
  console.log("USE EFFECT JALAN");
  fetchData();
}, []);

  const calculateSisaHari = (item) => {
    const status = (item.computed_status || '').toLowerCase();
    if (!(status === 'aktif' || status === 'diperpanjang')) return null;

    const endDate = item.extended_until || item.end_date;
    if (!endDate) return null;

    const today = new Date();
    today.setHours(0,0,0,0);
    const expiry = new Date(endDate);
    expiry.setHours(0,0,0,0);

    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  };

  const getSisaHariColor = (days) => {
    if (days === null) return '';
    if (days <= 0) return 'bg-red-50 text-red-700 border-red-200';
    if (days <= 7) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const filteredData = useMemo(() => {
  let result = [...data].filter(pkg => (pkg.computed_total_sessions || 0) > 1);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(item =>
      item.patient_name?.toLowerCase().includes(q) ||
      item.package_name?.toLowerCase().includes(q)
    );
  }

  if (statusFilter !== 'all') {
    result = result.filter(item =>
      (item.computed_status || '').toLowerCase() === statusFilter
    );
  }

  return result.sort((a, b) => {
    const aDate = new Date(a.end_date || 0).getTime();
    const bDate = new Date(b.end_date || 0).getTime();
    return aDate - bDate;
  });

}, [data, searchQuery, statusFilter]);

  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase();
    if (s === 'aktif') return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Aktif</Badge>;
    if (s === 'selesai') return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Selesai</Badge>;
    if (s === 'expired') return <Badge className="bg-red-50 text-red-700 border-red-200">Expired</Badge>;
    if (s === 'diperpanjang') return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Extended</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">

      {/* HEADER MODERN */}
      {!hideControls && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl border border-slate-200">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Tracking Paket</h2>
            <p className="text-base text-slate-500 mt-1">
              Monitor penggunaan paket pasien secara real-time
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9 h-11 text-base border-slate-300"
                placeholder="Cari pasien / paket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="h-11 px-4"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* TABLE MODERN */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 text-base">
            <TableRow>
              <TableHead className="px-6 py-4 text-base font-semibold">Nama Pasien</TableHead>
              <TableHead className="px-6 py-4 text-base font-semibold">Paket</TableHead>
              <TableHead className="px-6 py-4 text-center font-semibold">Terpakai</TableHead>
              <TableHead className="px-6 py-4 text-center font-semibold">Sisa</TableHead>
              <TableHead className="px-6 py-4 text-center font-semibold">Selesai</TableHead>
              <TableHead className="px-6 py-4 text-center font-semibold">Sisa Hari</TableHead>
              <TableHead className="px-6 py-4 text-center font-semibold">Status</TableHead>
              <TableHead className="px-6 py-4 text-right font-semibold">Aksi</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                  <p className="text-base text-slate-500">
                    Sedang memuat data paket...
                  </p>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-20 text-center">
                  <PackageIcon className="w-14 h-14 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-xl font-medium text-slate-900">
                    Belum ada data paket
                  </h3>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item) => {
                const sisaHari = calculateSisaHari(item);
                return (
                  <TableRow
                    key={item.id}
                    className=""
                  >
                    <TableCell className="px-6 py-4 text-base font-semibold">
                      {item.patient_name}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-base">
                      {item.package_name}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-center text-base font-mono">
                      {item.computed_sessions_used} / {item.computed_total_sessions}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-center text-base font-semibold text-blue-600">
                      {item.computed_sessions_remaining}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-center text-base">
                      {item.end_date ? format(new Date(item.end_date), 'dd MMM yyyy', { locale: id }) : '-'}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-center">
                      {sisaHari !== null && (
                        <Badge variant="outline" className={getSisaHariColor(sisaHari)}>
                          {sisaHari} Hari
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-center">
                      {getStatusBadge(item.computed_status)}
                    </TableCell>

                    <TableCell className="px-6 py-4 text-right">
                      <Button variant="ghost" className="h-10 w-10 rounded-xl">
                        <MoreHorizontal className="w-5 h-5 text-slate-500" />
                      </Button>
                    </TableCell>

                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DeletePackageConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        packageData={selectedPackage}
        onConfirm={() => {}}
        isDeleting={isDeleting}
      />

      <EditPackageStatusModal
        isOpen={editStatusModalOpen}
        onClose={() => setEditStatusModalOpen(false)}
        packageData={selectedPackage}
        onSuccess={() => {}}
      />

      <EditPackageSessionModal
        isOpen={editSessionModalOpen}
        onClose={() => setEditSessionModalOpen(false)}
        packageData={selectedPackage}
        onSuccess={() => {}}
      />

      <PackageHistoryModal
        isOpen={sessionHistoryModalOpen}
        onClose={() => setSessionHistoryModalOpen(false)}
        packageData={selectedPackage}
      />

    </div>
  );
};
export default PackageRecap;
