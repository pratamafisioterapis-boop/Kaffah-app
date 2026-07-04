import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Building2, Trash2, Pencil, UserPlus } from 'lucide-react';

const emptyForm = { id: null, name: '', address: '', phone: '', subscription_status: 'active' };
const emptyOwnerForm = { full_name: '', email: '', password: '', phone: '' };
const emptyEditOwnerForm = { id: null, full_name: '', phone: '' };

const SuperAdminClinics = () => {
  const { toast } = useToast();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerForm, setOwnerForm] = useState(emptyOwnerForm);
  const [ownerClinic, setOwnerClinic] = useState(null);
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [owners, setOwners] = useState({});
  const [editOwnerOpen, setEditOwnerOpen] = useState(false);
  const [editOwnerForm, setEditOwnerForm] = useState(emptyEditOwnerForm);
  const [savingOwnerEdit, setSavingOwnerEdit] = useState(false);

  const fetchClinics = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clinics').select('*').order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat klinik', description: error.message });
    else setClinics(data || []);

    const { data: ownerRows } = await supabase.from('users').select('id, full_name, phone, clinic_id').eq('role', 'owner');
    const ownerMap = {};
    (ownerRows || []).forEach((o) => { ownerMap[o.clinic_id] = o; });
    setOwners(ownerMap);

    setLoading(false);
  };

  const openEditOwner = (owner) => {
    setEditOwnerForm({ id: owner.id, full_name: owner.full_name || '', phone: owner.phone || '' });
    setEditOwnerOpen(true);
  };

  const handleSaveOwnerEdit = async () => {
    if (!editOwnerForm.full_name?.trim()) {
      toast({ variant: 'destructive', title: 'Nama owner wajib diisi' });
      return;
    }
    setSavingOwnerEdit(true);
    const { error } = await supabase.from('users').update({
      full_name: editOwnerForm.full_name,
      phone: editOwnerForm.phone || null,
    }).eq('id', editOwnerForm.id);
    setSavingOwnerEdit(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal update owner', description: error.message });
    } else {
      toast({ title: 'Owner diperbarui' });
      setEditOwnerOpen(false);
      fetchClinics();
    }
  };

  useEffect(() => { fetchClinics(); }, []);

  const openCreate = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (clinic) => { setForm(clinic); setOpen(true); };
  const openCreateOwner = (clinic) => { setOwnerClinic(clinic); setOwnerForm(emptyOwnerForm); setOwnerOpen(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ variant: 'destructive', title: 'Nama klinik wajib diisi' });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address || null,
      phone: form.phone || null,
      subscription_status: form.subscription_status || 'active',
    };
    const { error } = form.id
      ? await supabase.from('clinics').update(payload).eq('id', form.id)
      : await supabase.from('clinics').insert(payload);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    } else {
      toast({ title: form.id ? 'Klinik diperbarui' : 'Klinik ditambahkan' });
      setOpen(false);
      fetchClinics();
    }
  };

  const handleToggleActive = async (clinic) => {
    const newStatus = clinic.subscription_status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('clinics').update({ subscription_status: newStatus }).eq('id', clinic.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal update status', description: error.message });
    else fetchClinics();
  };

  const handleDelete = async (clinic) => {
    if (!window.confirm(`Hapus klinik "${clinic.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    const { error } = await supabase.from('clinics').delete().eq('id', clinic.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
    else { toast({ title: 'Klinik dihapus' }); fetchClinics(); }
  };

  const handleCreateOwner = async () => {
    if (!ownerForm.full_name || !ownerForm.email || !ownerForm.password) {
      toast({ variant: 'destructive', title: 'Nama, email, dan password wajib diisi' });
      return;
    }
    if (ownerForm.password.length < 6) {
      toast({ variant: 'destructive', title: 'Password minimal 6 karakter' });
      return;
    }
    setCreatingOwner(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/admin-create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email: ownerForm.email,
          password: ownerForm.password,
          full_name: ownerForm.full_name,
          phone: ownerForm.phone,
          role: 'owner',
          clinic_id: ownerClinic.id,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Gagal membuat owner', description: result.error });
      } else {
        toast({ title: 'Owner berhasil dibuat', description: `${ownerForm.email} kini owner ${ownerClinic.name}` });
        setOwnerOpen(false);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membuat owner', description: err.message });
    } finally {
      setCreatingOwner(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" /> Manajemen Klinik
          </h1>
          <p className="text-sm text-slate-500">Kelola seluruh klinik yang terdaftar di sistem.</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Tambah Klinik
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y">
          {clinics.length === 0 && <p className="p-6 text-center text-slate-500">Belum ada klinik terdaftar.</p>}
          {clinics.map((clinic) => (
            <div key={clinic.id} className="flex items-center justify-between p-4 flex-wrap gap-2">
              <div>
                <p className="font-semibold text-slate-800">{clinic.name}</p>
                <p className="text-sm text-slate-500">{clinic.address || '-'} • {clinic.phone || '-'}</p>
                <p className="text-sm text-blue-600 mt-1">
                  Owner: {owners[clinic.id]?.full_name || <span className="text-slate-400 italic">belum ada</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full ${clinic.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {clinic.subscription_status === 'active' ? 'Aktif' : 'Nonaktif'}
                </span>
                {owners[clinic.id] ? (
                  <Button size="sm" variant="outline" onClick={() => openEditOwner(owners[clinic.id])}>
                    <Pencil className="w-4 h-4 mr-1" /> Edit Owner
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => openCreateOwner(clinic)}>
                    <UserPlus className="w-4 h-4 mr-1" /> Tambah Owner
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleToggleActive(clinic)}>
                  {clinic.subscription_status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(clinic)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(clinic)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit Klinik' : 'Tambah Klinik'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Nama Klinik</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama Klinik" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Alamat</label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">No. Telepon</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="No. Telepon" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ownerOpen} onOpenChange={setOwnerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Owner untuk {ownerClinic?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Nama Lengkap</label>
              <Input value={ownerForm.full_name} onChange={(e) => setOwnerForm({ ...ownerForm, full_name: e.target.value })} placeholder="Nama Owner" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Email Login</label>
              <Input type="email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} placeholder="owner@klinik.com" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">No. Telepon</label>
              <Input value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Password</label>
              <Input type="password" value={ownerForm.password} onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })} placeholder="Minimal 6 karakter" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOwnerOpen(false)}>Batal</Button>
            <Button onClick={handleCreateOwner} disabled={creatingOwner} className="bg-blue-600">
              {creatingOwner && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Buat Owner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <Dialog open={editOwnerOpen} onOpenChange={setEditOwnerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Owner</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Nama Lengkap</label>
              <Input value={editOwnerForm.full_name} onChange={(e) => setEditOwnerForm({ ...editOwnerForm, full_name: e.target.value })} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">No. Telepon</label>
              <Input value={editOwnerForm.phone} onChange={(e) => setEditOwnerForm({ ...editOwnerForm, phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOwnerOpen(false)}>Batal</Button>
            <Button onClick={handleSaveOwnerEdit} disabled={savingOwnerEdit} className="bg-blue-600">
              {savingOwnerEdit && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminClinics;