import React, { useState, useEffect } from 'react';
import { 
  getBadgesByOwner, createBadge, updateBadge, deleteBadge 
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Edit2, Shield } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const BadgeManager = () => {
  const { toast } = useToast();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [formData, setFormData] = useState({ label: '', color: '#e0f2fe' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    setLoading(true);
    const { data, error } = await getBadgesByOwner();
    if (data) {
      setBadges(data);
    } else {
      toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to fetch badges" });
    }
    setLoading(false);
  };

  const handleOpenDialog = (badge = null) => {
    if (badge) {
      setEditingBadge(badge);
      setFormData({ label: badge.label, color: badge.color || '#e0f2fe' });
    } else {
      setEditingBadge(null);
      setFormData({ label: '', color: '#e0f2fe' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.label.trim()) {
      toast({ variant: "destructive", title: "Validasi", description: "Label badge wajib diisi" });
      return;
    }

    setSubmitting(true);
    let result;
    
    if (editingBadge) {
      result = await updateBadge(editingBadge.id, formData);
    } else {
      result = await createBadge(formData);
    }

    if (result.data) {
      toast({ title: "Berhasil", description: editingBadge ? "Badge diperbarui" : "Badge ditambahkan" });
      fetchBadges();
      setIsDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal", description: result.error?.message });
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    const { error } = await deleteBadge(deleteConfirm.id);
    if (!error) {
      toast({ title: "Terhapus", description: "Badge telah dihapus" });
      setBadges(prev => prev.filter(b => b.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
             <Shield className="w-5 h-5 text-blue-600" /> Pengaturan Badge Profesional
           </h3>
           <p className="text-sm text-slate-500">Kelola badge dan label khusus untuk ditampilkan di profil terapis.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Tambah Badge
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label Badge</TableHead>
                <TableHead>Warna</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {badges.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={4} className="text-center py-8 text-slate-500 italic">
                      Belum ada badge. Silakan tambahkan badge baru.
                   </TableCell>
                </TableRow>
              ) : (
                badges.map((badge) => (
                  <TableRow key={badge.id}>
                    <TableCell className="font-medium">{badge.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded border shadow-sm" style={{ backgroundColor: badge.color }}></div>
                        <span className="text-xs font-mono text-slate-500">{badge.color}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span 
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-black/5"
                        style={{ backgroundColor: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(badge)}>
                          <Edit2 className="w-3 h-3 text-slate-500" />
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(badge)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBadge ? 'Edit Badge' : 'Tambah Badge Baru'}</DialogTitle>
            <DialogDescription>
              Badge ini akan tersedia untuk dipilih pada profil terapis.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <label className="text-sm font-medium">Label Badge (Max 50 kar)</label>
               <Input 
                 value={formData.label} 
                 onChange={(e) => setFormData({...formData, label: e.target.value})} 
                 maxLength={50}
                 placeholder="Contoh: Senior Therapist"
               />
            </div>
            <div className="space-y-2">
               <label className="text-sm font-medium">Warna Background</label>
               <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={formData.color} 
                    onChange={(e) => setFormData({...formData, color: e.target.value})} 
                    className="h-10 w-20 p-1 rounded border cursor-pointer"
                  />
                  <Input 
                    value={formData.color} 
                    onChange={(e) => setFormData({...formData, color: e.target.value})} 
                    placeholder="#RRGGBB"
                    className="font-mono"
                  />
               </div>
            </div>
            <div className="pt-2">
               <label className="text-xs font-medium text-slate-500 block mb-2">Preview Tampilan:</label>
               <div className="p-4 bg-slate-50 rounded border flex justify-center">
                  <span 
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-black/5"
                    style={{ backgroundColor: formData.color || '#e0f2fe' }}
                  >
                    {formData.label || 'Label Badge'}
                  </span>
               </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-blue-600">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>Hapus Badge?</DialogTitle>
               <DialogDescription>
                  Anda akan menghapus badge "{deleteConfirm?.label}". Badge ini akan hilang dari semua profil terapis yang menggunakannya.
               </DialogDescription>
            </DialogHeader>
            <DialogFooter>
               <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Batal</Button>
               <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
};

export default BadgeManager;