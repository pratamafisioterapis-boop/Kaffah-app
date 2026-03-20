import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  AlertTriangle,
  Users,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  deletePatient, 
  createPatient, 
  updatePatient, 
  getUser
} from '@/lib/api';
import { normalizePatient } from '@/lib/patientHelpers';
import PatientList from '@/components/admin/patients/PatientList'; 
import PatientDialog from '@/components/admin/PatientDialog';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const OwnerPatientManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State for Bulk Delete Functionality
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDateRange, setDeleteDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [deleting, setDeleting] = useState(false);

  // State for Single Delete Functionality
  const [singleDeleteDialogOpen, setSingleDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);

  // State for Add/Edit Patient Functionality
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [clinicId, setClinicId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (user?.id) {
        fetchUserClinic();
    }
  }, [user]);

  const fetchUserClinic = async () => {
    const { data } = await getUser(user.id);
    if (data?.clinic_id) {
        setClinicId(data.clinic_id);
    }
  };

  // --- Bulk Delete Handlers ---
  const handleDeleteByRange = async () => {
    if (!deleteDateRange.startDate || !deleteDateRange.endDate) {
      toast({
        variant: "destructive",
        title: "Error Validasi",
        description: "Harap pilih tanggal mulai dan tanggal akhir."
      });
      return;
    }

    if (new Date(deleteDateRange.startDate) > new Date(deleteDateRange.endDate)) {
       toast({
        variant: "destructive",
        title: "Error Validasi",
        description: "Tanggal mulai tidak boleh lebih besar dari tanggal akhir."
      });
      return;
    }

    if (!window.confirm(`PERINGATAN: Anda akan menghapus SEMUA data pasien yang DIDAFTARKAN (created_at) dari tanggal ${deleteDateRange.startDate} sampai ${deleteDateRange.endDate}. \n\nIni akan menghapus SEMUA data terkait (Rekam medis, appointment, paket, dll) secara permanen. \n\nLanjutkan?`)) {
        return;
    }

    setDeleting(true);
    try {
      const { data: patients, error: fetchError } = await supabase
        .from('patients')
        .select('id')
        .gte('created_at', `${deleteDateRange.startDate}T00:00:00`)
        .lte('created_at', `${deleteDateRange.endDate}T23:59:59`);

      if (fetchError) throw fetchError;

      if (!patients || patients.length === 0) {
        toast({ title: "Info", description: "Tidak ada pasien ditemukan dalam rentang tanggal tersebut." });
        setDeleting(false);
        return;
      }

      const deletePromises = patients.map(p => deletePatient(p.id));
      const results = await Promise.allSettled(deletePromises);
      
      const successCount = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
         toast({
            variant: "warning",
            title: "Penghapusan Selesai Sebagian",
            description: `Berhasil: ${successCount}, Gagal: ${failCount}. Cek log untuk detail.`
         });
      } else {
         toast({
            title: "Penghapusan Berhasil",
            description: `${successCount} data pasien telah dihapus permanen beserta data terkait.`
         });
      }

      setDeleteDialogOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal Menghapus",
        description: err.message
      });
    } finally {
      setDeleting(false);
    }
  };

  // --- Single Delete Handlers ---
  const handleSingleDeleteClick = (patient) => {
    setPatientToDelete(patient);
    setSingleDeleteDialogOpen(true);
  };

  const handleSingleHardDelete = async () => {
    if (patientToDelete) {
        const { error } = await deletePatient(patientToDelete.id);
        if (error) {
            toast({ variant: "destructive", title: "Gagal Hapus Permanen", description: error.message });
        } else {
            toast({ title: "Terhapus Permanen", description: "Pasien dan seluruh data terkait telah dihapus." });
            setRefreshTrigger(prev => prev + 1);
        }
        setSingleDeleteDialogOpen(false);
        setPatientToDelete(null);
    }
  };

  // --- Add/Edit Handlers ---
  const handleAddNewClick = () => {
    setEditingPatient(null);
    setPatientDialogOpen(true);
  };

  const handleEditClick = (patient) => {
    // We normalize here just in case, though PatientList should already pass normalized
    setEditingPatient(normalizePatient(patient));
    setPatientDialogOpen(true);
  };

  const handleSavePatient = async (patientData) => {
    // Ensure we send correct field names to backend
    // patientData comes from PatientDialog which should already be validated
    
    let error;
    if (editingPatient) {
        const { error: updateError } = await updatePatient(editingPatient.id, patientData);
        error = updateError;
        if (!error) toast({ title: "Berhasil", description: "Data pasien berhasil diperbarui." });
    } else {
        const payload = {
            ...patientData,
            clinic_id: clinicId
        };
        const { error: createError } = await createPatient(payload);
        error = createError;
        if (!error) toast({ title: "Berhasil", description: "Pasien baru berhasil ditambahkan." });
    }

    if (error) {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
        return { error }; // Pass error back to dialog
    } else {
        setRefreshTrigger(prev => prev + 1);
        setPatientDialogOpen(false);
        setEditingPatient(null);
        return { success: true };
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-red-800 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Area Pemilik: Hapus Pasien Masal
          </h3>
          <p className="text-sm text-red-600">Fitur ini menghapus data pasien berdasarkan tanggal pendaftaran (Created At).</p>
        </div>
        <Button 
          variant="destructive" 
          onClick={() => setDeleteDialogOpen(true)}
          className="bg-red-600 hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Hapus Berdasarkan Tanggal Daftar
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">Daftar Pasien</h2>
          </div>
          <Button onClick={handleAddNewClick} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Tambah Pasien
          </Button>
        </div>
        
        <PatientList 
            onEdit={handleEditClick} 
            onDelete={handleSingleDeleteClick}
            refreshTrigger={refreshTrigger} 
        />
      </div>

      <PatientDialog 
        open={patientDialogOpen}
        onOpenChange={setPatientDialogOpen}
        onSubmit={handleSavePatient}
        initialData={editingPatient}
        onDelete={handleSingleDeleteClick}
      />

      {/* Bulk Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
               <Trash2 className="w-5 h-5" /> Hapus Data Pasien (Masal)
            </DialogTitle>
            <DialogDescription>
              Pilih rentang tanggal pendaftaran pasien. <br/>
              <span className="font-bold text-red-500">PERINGATAN: Data dihapus permanen! Semua data terkait (rekam medis, paket, dll) juga akan dihapus.</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dari Tanggal (Daftar)</label>
              <Input
                type="date"
                value={deleteDateRange.startDate}
                onChange={(e) => setDeleteDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sampai Tanggal (Daftar)</label>
              <Input
                type="date"
                value={deleteDateRange.endDate}
                onChange={(e) => setDeleteDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteByRange}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Menghapus...' : 'Hapus Permanen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Dialog */}
      <Dialog open={singleDeleteDialogOpen} onOpenChange={setSingleDeleteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-900">
                    <Trash2 className="h-5 w-5 text-red-600" />
                    Hapus Data Pasien
                </DialogTitle>
                <DialogDescription className="pt-2">
                    Anda akan menghapus pasien <strong>{patientToDelete?.full_name}</strong>.
                    <br/>
                    <span className="text-red-600 font-semibold">PERINGATAN: Tindakan ini tidak dapat dibatalkan.</span>
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
                <Button variant="destructive" onClick={handleSingleHardDelete} className="w-full justify-between group">
                    <div className="flex flex-col items-start">
                        <span className="font-medium">Hapus Permanen & Semua Data</span>
                        <span className="text-[10px] font-normal opacity-90">Menghapus pasien, rekam medis, paket, & transaksi</span>
                    </div>
                    <span className="text-xs bg-red-700 px-2 py-0.5 rounded text-white group-hover:bg-red-800">Hard Delete</span>
                </Button>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => { setSingleDeleteDialogOpen(false); setPatientToDelete(null); }}>Batal</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerPatientManagement;