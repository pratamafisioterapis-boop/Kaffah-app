import React, { useState, useEffect } from 'react';
import { 
  Plus, Upload, Trash2, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  createPatient, 
  updatePatient, 
  deletePatient,
  getUser,
  sendPushNotification 
} from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import PatientDialog from '@/components/admin/PatientDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PatientList from '@/components/admin/patients/PatientList';
import PatientImportCSV from '@/components/admin/PatientImportCSV';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PatientManagement = () => {
  const { toast } = useToast();
  const [clinicId, setClinicId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("list");
  
  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  
  // Delete Confirmation State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchUserClinic();
    }
  }, [user]);

  const fetchUserClinic = async () => {
    try {
      const { data, error } = await getUser(user.id);
      if (error) throw error;
      if (data?.clinic_id) {
        setClinicId(data.clinic_id);
      }
    } catch (err) {
      console.error("Failed to fetch user clinic info:", err);
    }
  };

  const handleSavePatient = async (patientData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Anda harus login untuk melakukan aksi ini." });
      return;
    }

    let error;
    
    try {
      if (editingPatient) {
        // Update existing
        const { error: updateError } = await updatePatient(editingPatient.id, patientData);
        error = updateError;
        if (!error) {
          toast({ title: "Berhasil", description: "Data pasien berhasil diperbarui." });
        }
      } else {
        // Create new
        const payload = {
          ...patientData,
          // Removed created_by as it doesn't exist in schema
          clinic_id: clinicId
        };

        const { data: newPatient, error: createError } = await createPatient(payload);
        error = createError;
        if (!error) {
          toast({ title: "Berhasil", description: "Pasien baru berhasil ditambahkan." });
          
          if (newPatient) {
            // Non-blocking notification
            sendPushNotification({
              user_id: user?.id,
              title: "Pasien Baru",
              body: `${newPatient.full_name} telah ditambahkan ke sistem.`,
              appointment_date: null,
              appointment_id: null
            }).catch(err => console.warn("Push notification failed", err));
          }
        }
      }
      
      if (error) {
        console.error("Save error:", error);
        throw error;
      } else {
        setRefreshTrigger(prev => prev + 1); // Trigger List Refresh
        setDialogOpen(false);
        setEditingPatient(null);
      }
    } catch (err) {
      // Re-throw to be caught by the dialog's internal handler
      throw err;
    }
  };

  const handleEditClick = (patient) => {
    setEditingPatient(patient);
    setDialogOpen(true);
  };

  const handleAddNewClick = () => {
    setEditingPatient(null);
    setDialogOpen(true);
  };

  const handleDeleteClick = (patient) => {
    setPatientToDelete(patient);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (patientToDelete) {
        try {
          // Hard delete and add RM to pool
          const { error } = await deletePatient(patientToDelete.id, patientToDelete.rm_number);
          if (error) {
              toast({ variant: "destructive", title: "Gagal Menghapus", description: error.message });
          } else {
              toast({ title: "Berhasil", description: "Pasien berhasil dihapus permanen." });
              setRefreshTrigger(prev => prev + 1);
          }
        } catch (err) {
          console.error("Delete error:", err);
          toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan saat menghapus data." });
        } finally {
          setDeleteDialogOpen(false);
          setPatientToDelete(null);
        }
    }
  };

  const onImportSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab("list"); 
  };

  if (authLoading) {
    return <div className="p-6 text-center text-slate-500">Memuat data autentikasi...</div>;
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Akses Ditolak</AlertTitle>
        <AlertDescription>
          Anda tidak memiliki izin untuk mengakses halaman ini. Silakan login kembali.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manajemen Pasien</h1>
          <p className="text-slate-600 mt-1">Kelola data pasien dan rekam medis.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <TabsList className="grid w-full sm:w-auto grid-cols-2">
              <TabsTrigger value="list">Daftar Pasien</TabsTrigger>
              <TabsTrigger value="import">Import CSV</TabsTrigger>
            </TabsList>
            
            {activeTab === "list" && (
               <Button onClick={handleAddNewClick} className="bg-blue-600 hover:bg-blue-700">
                 <Plus className="w-4 h-4 mr-2" />
                 Tambah Pasien Manual
               </Button>
            )}
          </div>

          <TabsContent value="list" className="space-y-4">
             <PatientList 
               onEdit={handleEditClick}
               onDelete={handleDeleteClick}
               refreshTrigger={refreshTrigger}
             />
          </TabsContent>

          <TabsContent value="import">
             <PatientImportCSV onImportSuccess={onImportSuccess} />
          </TabsContent>
        </Tabs>
      </div>

      <PatientDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSubmit={handleSavePatient} 
        initialData={editingPatient}
        onDelete={handleDeleteClick} 
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-900">
                    <Trash2 className="h-5 w-5 text-red-600" />
                    Hapus Data Pasien
                </DialogTitle>
                <DialogDescription className="pt-2">
                    Anda akan menghapus pasien <strong>{patientToDelete?.full_name}</strong> ({patientToDelete?.rm_number}).
                    <br/>
                    <span className="text-red-600 font-semibold">PERINGATAN: Data ini akan dihapus secara PERMANEN beserta seluruh rekam medis dan riwayatnya.</span>
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setPatientToDelete(null); }}>Batal</Button>
                <Button variant="destructive" onClick={handleDeleteConfirm}>Hapus Permanen</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientManagement;