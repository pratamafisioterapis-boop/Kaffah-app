import React, { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  RefreshCw, Search, Eye
} from "lucide-react";
import { supabase } from "@/lib/customSupabaseClient";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const PackageHistory = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('package_tracking')
        .select(`
          *,
          patients (full_name, medical_record_number)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error("Error fetching packages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [statusFilter]);

  const filteredPackages = packages.filter(pkg => 
    pkg.patients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pkg.package_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pkg.patients?.medical_record_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch(status) {
      case 'aktif': return <Badge className="bg-green-500">Aktif</Badge>;
      case 'habis': return <Badge className="bg-gray-500">Habis</Badge>;
      case 'expired': return <Badge className="bg-red-500">Expired</Badge>;
      case 'pending': return <Badge className="bg-yellow-500">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewDetail = (pkg) => {
    setSelectedPackage(pkg);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Riwayat Paket</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
           <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari pasien atau paket..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="aktif">Aktif</SelectItem>
              <SelectItem value="habis">Habis</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchPackages}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pasien</TableHead>
              <TableHead>Paket</TableHead>
              <TableHead>Sesi</TableHead>
              <TableHead>Masa Berlaku</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : filteredPackages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Tidak ada data paket ditemukan.</TableCell>
              </TableRow>
            ) : (
              filteredPackages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="font-medium">{pkg.patients?.full_name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{pkg.patients?.medical_record_number}</div>
                  </TableCell>
                  <TableCell>{pkg.package_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pkg.sessions_used}</span>
                      <span className="text-muted-foreground">/ {pkg.total_sessions}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {pkg.start_date ? format(new Date(pkg.start_date), 'dd MMM yyyy', { locale: id }) : '-'} 
                      <span className="mx-1">s/d</span>
                      {pkg.end_date ? format(new Date(pkg.end_date), 'dd MMM yyyy', { locale: id }) : '-'}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(pkg.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetail(pkg)}>
                      <Eye className="h-4 w-4 mr-1" /> Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detail Paket</DialogTitle>
            <DialogDescription>Informasi lengkap mengenai paket pasien.</DialogDescription>
          </DialogHeader>
          
          {selectedPackage && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Nama Pasien</p>
                  <p className="text-sm font-semibold">{selectedPackage.patients?.full_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">No. RM</p>
                  <p className="text-sm">{selectedPackage.patients?.medical_record_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Nama Paket</p>
                  <p className="text-sm">{selectedPackage.package_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div>{getStatusBadge(selectedPackage.status)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Sesi Terpakai</p>
                  <p className="text-sm">{selectedPackage.sessions_used} dari {selectedPackage.total_sessions}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Sisa Sesi</p>
                  <p className="text-sm">{selectedPackage.sessions_remaining}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Tanggal Mulai</p>
                  <p className="text-sm">{selectedPackage.start_date ? format(new Date(selectedPackage.start_date), 'dd MMMM yyyy', { locale: id }) : '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Tanggal Berakhir</p>
                  <p className="text-sm">{selectedPackage.end_date ? format(new Date(selectedPackage.end_date), 'dd MMMM yyyy', { locale: id }) : '-'}</p>
                </div>
                 <div className="space-y-1 col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Nominal</p>
                  <p className="text-sm">Rp {selectedPackage.nominal?.toLocaleString('id-ID') || '0'}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PackageHistory;