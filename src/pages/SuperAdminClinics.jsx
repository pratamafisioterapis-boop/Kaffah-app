import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Building2, Trash2, Pencil, UserPlus, SlidersHorizontal } from 'lucide-react';
import { ROLES, ROLE_LABELS, getFeatureCatalogForRole, SETUP_SUB_FEATURES } from '@/lib/featureCatalog';
import { cn } from '@/lib/utils';

const emptyForm = {
  id: null, name: '', address: '', phone: '', subscription_status: 'active',
  owner_full_name: '', owner_email: '', owner_phone: '', owner_password: '',
};
const emptyOwnerForm = { full_name: '', email: '', password: '', phone: '' };
const emptyEditOwnerForm = { id: null, full_name: '', phone: '' };

// Reference clinic whose Diagnosa + Layanan (parent service) list is cloned
// into every newly created clinic, so new owners start with a ready-made
// list instead of an empty one. This is a one-time copy at creation time —
// the cloned rows get fresh ids and belong to the new clinic, so editing
// either clinic's list afterward never affects the other.
const REFERENCE_CLINIC_ID = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'; // Kaffah Physiotherapy

const seedDiagnosaFromReferenceClinic = async (targetClinicId) => {
  const [{ data: services, error: servicesError }, { data: diagnoses, error: diagnosesError }] = await Promise.all([
    supabase.from('operational_options').select('*').eq('clinic_id', REFERENCE_CLINIC_ID).eq('category', 'service'),
    supabase.from('operational_options').select('*').eq('clinic_id', REFERENCE_CLINIC_ID).eq('category', 'diagnosa'),
  ]);
  if (servicesError) throw servicesError;
  if (diagnosesError) throw diagnosesError;

  const idMap = {};
  const newServices = (services || []).map((s) => {
    const newId = crypto.randomUUID();
    idMap[s.id] = newId;
    return {
      id: newId,
      category: s.category,
      label: s.label,
      is_active: s.is_active,
      session_count: s.session_count,
      validity_days: s.validity_days,
      parent_id: null,
      clinic_id: targetClinicId,
    };
  });

  const newDiagnoses = (diagnoses || []).map((d) => ({
    id: crypto.randomUUID(),
    category: d.category,
    label: d.label,
    is_active: d.is_active,
    session_count: d.session_count,
    validity_days: d.validity_days,
    parent_id: d.parent_id ? (idMap[d.parent_id] || null) : null,
    clinic_id: targetClinicId,
  }));

  if (newServices.length) {
    const { error } = await supabase.from('operational_options').insert(newServices);
    if (error) throw error;
  }
  if (newDiagnoses.length) {
    const { error } = await supabase.from('operational_options').insert(newDiagnoses);
    if (error) throw error;
  }
};

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
  const [featureRoleTab, setFeatureRoleTab] = useState({}); // { [clinicId]: 'owner' | 'admin' | 'therapist' }

  const fetchClinics = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clinics').select('*').order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat klinik', description: error.message });
    else setClinics(data || []);

    const { data: ownerRows } = await supabase.from('users').select('id, full_name, email, phone, clinic_id').eq('role', 'owner').order('created_at', { ascending: true });
    const ownerMap = {};
    (ownerRows || []).forEach((o) => {
      if (!ownerMap[o.clinic_id]) ownerMap[o.clinic_id] = [];
      ownerMap[o.clinic_id].push(o);
    });
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
    if (!form.id) {
      if (!form.owner_full_name?.trim() || !form.owner_email?.trim() || !form.owner_password?.trim()) {
        toast({ variant: 'destructive', title: 'Nama, email, dan password owner wajib diisi' });
        return;
      }
      if (form.owner_password.length < 6) {
        toast({ variant: 'destructive', title: 'Password owner minimal 6 karakter' });
        return;
      }
    }

    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address || null,
      phone: form.phone || null,
      subscription_status: form.subscription_status || 'active',
    };

    if (form.id) {
      const { error } = await supabase.from('clinics').update(payload).eq('id', form.id);
      setSaving(false);
      if (error) {
        toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
        return;
      }
      toast({ title: 'Klinik diperbarui' });
      setOpen(false);
      fetchClinics();
      return;
    }

    const { data: newClinic, error } = await supabase.from('clinics').insert(payload).select().single();
    if (error) {
      setSaving(false);
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }

    if (newClinic.id !== REFERENCE_CLINIC_ID) {
      try {
        await seedDiagnosaFromReferenceClinic(newClinic.id);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Klinik dibuat, tapi gagal menyalin data Diagnosa & Layanan',
          description: err.message,
        });
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/admin-create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email: form.owner_email,
          password: form.owner_password,
          full_name: form.owner_full_name,
          phone: form.owner_phone,
          role: 'owner',
          clinic_id: newClinic.id,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Klinik dibuat, tapi gagal membuat akun owner',
          description: `${result.error} — gunakan tombol "Tambah Owner" untuk mencoba lagi.`,
        });
      } else {
        toast({ title: 'Klinik & akun owner berhasil dibuat', description: `${form.owner_email} kini owner ${form.name}` });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Klinik dibuat, tapi gagal membuat akun owner',
        description: `${err.message} — gunakan tombol "Tambah Owner" untuk mencoba lagi.`,
      });
    } finally {
      setSaving(false);
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

  const toggleFeature = async (clinic, role, featureKey) => {
    const currentByRole = clinic.disabled_features_by_role || {};
    const currentForRole = currentByRole[role] || [];
    const nextForRole = currentForRole.includes(featureKey)
      ? currentForRole.filter((k) => k !== featureKey)
      : [...currentForRole, featureKey];
    const nextByRole = { ...currentByRole, [role]: nextForRole };

    // Optimistic update
    setClinics((prev) => prev.map((c) => (c.id === clinic.id ? { ...c, disabled_features_by_role: nextByRole } : c)));

    const { error } = await supabase.from('clinics').update({ disabled_features_by_role: nextByRole }).eq('id', clinic.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal mengubah fitur', description: error.message });
      setClinics((prev) => prev.map((c) => (c.id === clinic.id ? { ...c, disabled_features_by_role: currentByRole } : c)));
    }
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
        fetchClinics();
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membuat owner', description: err.message });
    } finally {
      setCreatingOwner(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" /> Manajemen Klinik
          </h1>
          <p className="text-sm text-slate-500">Kelola seluruh klinik yang terdaftar di sistem.</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto justify-center whitespace-nowrap">
          <Plus className="w-4 h-4 mr-2 shrink-0" /> Tambah Klinik
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : clinics.length === 0 ? (
        <p className="p-6 text-center text-slate-500 bg-white rounded-xl border border-slate-200">Belum ada klinik terdaftar.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clinics.map((clinic) => (
            <div key={clinic.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{clinic.name}</p>
                  <p className="text-sm text-slate-500 truncate">{clinic.address || '-'}</p>
                  <p className="text-sm text-slate-500">{clinic.phone || '-'}</p>
                  <div className="text-sm text-blue-600 mt-1">
                    {(owners[clinic.id]?.length ?? 0) === 0 ? (
                      <span className="text-slate-400 italic">Owner: belum ada</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {owners[clinic.id].map((o) => (
                          <div key={o.id} className="flex items-center gap-1.5">
                            <span>Owner: {o.full_name}</span>
                            <button
                              type="button"
                              onClick={() => openEditOwner(o)}
                              className="text-slate-400 hover:text-blue-600"
                              title="Edit owner ini"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${clinic.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {clinic.subscription_status === 'active' ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => openCreateOwner(clinic)}>
                  <UserPlus className="w-4 h-4 mr-1" /> Tambah Owner
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleToggleActive(clinic)}>
                  {clinic.subscription_status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(clinic)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(clinic)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Fitur Klinik per Role
                </p>
                <div className="flex gap-1.5 mb-3">
                  {ROLES.map((r) => {
                    const activeRole = featureRoleTab[clinic.id] || 'owner';
                    const isActive = activeRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFeatureRoleTab((prev) => ({ ...prev, [clinic.id]: r }))}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors",
                          isActive
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                        )}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                  {getFeatureCatalogForRole(featureRoleTab[clinic.id] || 'owner').map((feature) => {
                    const activeRole = featureRoleTab[clinic.id] || 'owner';
                    const disabledForRole = clinic.disabled_features_by_role?.[activeRole] || [];
                    return (
                      <label key={feature.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <Checkbox
                          checked={!disabledForRole.includes(feature.key)}
                          onCheckedChange={() => toggleFeature(clinic, activeRole, feature.key)}
                        />
                        {feature.label}
                      </label>
                    );
                  })}
                </div>

                {(featureRoleTab[clinic.id] || 'owner') === 'owner' && (
                  <div className="mt-3 pl-3 border-l-2 border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Detail Menu Setup
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                      {SETUP_SUB_FEATURES.map((sub) => {
                        const disabledForRole = clinic.disabled_features_by_role?.owner || [];
                        return (
                          <label key={sub.key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <Checkbox
                              checked={!disabledForRole.includes(sub.key)}
                              onCheckedChange={() => toggleFeature(clinic, 'owner', sub.key)}
                            />
                            {sub.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
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

            {!form.id && (
              <>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-slate-700">Akun Owner</p>
                  <p className="text-xs text-slate-500">Dibuat langsung bersamaan dengan klinik.</p>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Nama Lengkap Owner</label>
                  <Input value={form.owner_full_name} onChange={(e) => setForm({ ...form, owner_full_name: e.target.value })} placeholder="Nama Owner" /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Email Login</label>
                  <Input type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} placeholder="owner@klinik.com" /></div>
                <div className="space-y-2"><label className="text-sm font-medium">No. Telepon Owner</label>
                  <Input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Password</label>
                  <Input type="password" value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} placeholder="Minimal 6 karakter" /></div>
              </>
            )}
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