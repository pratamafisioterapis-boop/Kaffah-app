import React, { useState, useEffect, useCallback } from 'react';
import { ListChecks, Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown, Power, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  getAdminChecklistItemsSetup, createAdminChecklistItem, updateAdminChecklistItem,
  deleteAdminChecklistItem, reorderAdminChecklistItem, getAdmins
} from '@/lib/api';
import { cn } from '@/lib/utils';

const AdminChecklistManager = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [scope, setScope] = useState(null); // null = task umum (semua admin), else admin.id
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '' });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getAdminChecklistItemsSetup(scope);
    if (!error) setItems(data || []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    getAdmins().then(({ data }) => setAdmins(data || []));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openAddDialog = () => {
    setFormData({ title: '', description: '' });
    setIsAddOpen(true);
  };

  const openEditDialog = (item) => {
    setSelectedItem(item);
    setFormData({ title: item.title, description: item.description || '' });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (item) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleSave = async (isEdit) => {
    if (!formData.title.trim()) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Judul task tidak boleh kosong.' });
      return;
    }
    setIsProcessing(true);
    try {
      let result;
      if (isEdit) {
        result = await updateAdminChecklistItem(selectedItem.id, {
          title: formData.title.trim(),
          description: formData.description.trim() || null
        });
      } else {
        result = await createAdminChecklistItem(formData.title, formData.description, scope);
      }
      if (result.error) throw result.error;

      toast({ title: isEdit ? 'Berhasil Diperbarui' : 'Berhasil Ditambahkan' });
      await fetchItems();
      setIsAddOpen(false);
      setIsEditOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setIsProcessing(true);
    try {
      const { error } = await deleteAdminChecklistItem(selectedItem.id);
      if (error) throw error;
      toast({ title: 'Terhapus' });
      setItems(items.filter(i => i.id !== selectedItem.id));
      setIsDeleteOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal Menghapus', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (item) => {
    const { data, error } = await updateAdminChecklistItem(item.id, { is_active: !item.is_active });
    if (!error) {
      setItems(items.map(i => i.id === item.id ? data : i));
    }
  };

  const handleReorder = async (item, direction) => {
    await reorderAdminChecklistItem(item.id, direction, items);
    fetchItems();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-[#0f1e3d]" />
            Checklist Task Admin Harian
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Daftar tugas ini akan muncul otomatis di Dashboard Admin (tab Operational) setiap hari.
          </p>
        </div>
        <Button onClick={openAddDialog} className="bg-[#0f1e3d] hover:bg-[#0b1830] gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> Tambah Task
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setScope(null)}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors",
            scope === null
              ? "bg-[#0f1e3d] text-white border-[#0f1e3d]"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          )}
        >
          <Users className="w-3.5 h-3.5" /> Umum (Semua Admin)
        </button>
        {admins.map((admin) => (
          <button
            key={admin.id}
            type="button"
            onClick={() => setScope(admin.id)}
            className={cn(
              "shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors",
              scope === admin.id
                ? "bg-[#0f1e3d] text-white border-[#0f1e3d]"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            {admin.full_name}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-3">
        {scope === null
          ? 'Task di sini muncul untuk semua admin di klinik ini.'
          : `Task di sini hanya muncul untuk ${admins.find(a => a.id === scope)?.full_name || 'admin ini'}.`}
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>Belum ada task checklist.</p>
            <Button variant="link" onClick={openAddDialog} className="text-[#0f1e3d] mt-1">Tambahkan task pertama</Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div key={item.id} className={`flex items-center gap-3 p-4 sm:p-5 transition-colors ${!item.is_active ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50/60'}`}>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => handleReorder(item, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded-md text-slate-400 hover:text-[#0f1e3d] hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleReorder(item, 'down')}
                    disabled={idx === items.length - 1}
                    className="p-1 rounded-md text-slate-400 hover:text-[#0f1e3d] hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 text-sm sm:text-base truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggleActive(item)}
                    title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    className={`p-2 rounded-lg transition-colors ${item.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEditDialog(item)} className="p-2 rounded-lg text-slate-500 hover:text-[#0f1e3d] hover:bg-slate-100">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => openDeleteDialog(item)} className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Tambah Task Checklist</DialogTitle>
            <DialogDescription>Task ini akan tampil di dashboard admin setiap hari.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Judul Task</label>
              <input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Contoh: Input rekap harian ke sistem"
                className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f1e3d]/40"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Deskripsi (opsional)</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detail singkat task ini"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button onClick={() => handleSave(false)} disabled={isProcessing} className="bg-[#0f1e3d] hover:bg-[#0b1830]">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Task Checklist</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Judul Task</label>
              <input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f1e3d]/40"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Deskripsi (opsional)</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
            <Button onClick={() => handleSave(true)} disabled={isProcessing} className="bg-[#0f1e3d] hover:bg-[#0b1830]">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Task Ini?</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedItem?.title}" akan dihapus permanen beserta riwayat penyelesaiannya. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminChecklistManager;