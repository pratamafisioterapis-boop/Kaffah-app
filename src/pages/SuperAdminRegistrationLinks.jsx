import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Plus, Ban, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHead, Panel, PanelTitle, Pill, EmptyState, Spinner, RowAction } from '@/components/superadmin/ui';
import { APP_DOMAIN } from '@/lib/domainRouting';

const buildLink = (token) => `https://${APP_DOMAIN}/register?token=${token}`;

const statusOf = (inv) => {
  if (inv.used_at) return { key: 'used', label: 'Sudah dipakai', tone: 'neutral' };
  if (inv.revoked_at) return { key: 'revoked', label: 'Dibatalkan', tone: 'bad' };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { key: 'expired', label: 'Kedaluwarsa', tone: 'warn' };
  return { key: 'active', label: 'Aktif', tone: 'ok' };
};

const fmt = (d) => (d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const SuperAdminRegistrationLinks = () => {
  const { toast } = useToast();
  const [invites, setInvites] = useState([]);
  const [clinicNames, setClinicNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState('7');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_registration_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memuat link', description: error.message });
      setLoading(false);
      return;
    }
    setInvites(data || []);
    const ids = [...new Set((data || []).map((i) => i.used_clinic_id).filter(Boolean))];
    if (ids.length) {
      const { data: clinics } = await supabase.from('clinics').select('id, name').in('id', ids);
      setClinicNames(Object.fromEntries((clinics || []).map((c) => [c.id, c.name])));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(buildLink(token));
      toast({ title: 'Link disalin', description: 'Kirim ke calon klinik. Hanya berlaku untuk satu kali registrasi.' });
    } catch {
      toast({ variant: 'destructive', title: 'Gagal menyalin', description: buildLink(token) });
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    const expires_at = days === 'none' ? null : new Date(Date.now() + Number(days) * 86400000).toISOString();
    const { data, error } = await supabase
      .from('clinic_registration_invites')
      .insert({ label: label.trim() || null, expires_at })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membuat link', description: error.message });
      return;
    }
    setLabel('');
    await copy(data.token);
    load();
  };

  const revoke = async (inv) => {
    const { error } = await supabase
      .from('clinic_registration_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inv.id)
      .is('used_at', null);
    if (error) toast({ variant: 'destructive', title: 'Gagal membatalkan', description: error.message });
    else { toast({ title: 'Link dibatalkan' }); load(); }
  };

  const remove = async (inv) => {
    const { error } = await supabase.from('clinic_registration_invites').delete().eq('id', inv.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
    else load();
  };

  return (
    <>
      <PageHead
        title="Link Registrasi"
        description="Pendaftaran terbuka di landing page dimatikan. Buat link di sini lalu kirim ke calon klinik. Setiap link hanya berlaku untuk satu kali registrasi."
      />

      <Panel>
        <PanelTitle>Buat link baru</PanelTitle>
        <form onSubmit={create} className="p-5 pt-3 flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-end">
          <label className="flex-1 min-w-0 text-xs font-medium text-app-muted">
            Catatan (opsional, hanya terlihat oleh Anda)
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mis. Klinik Sehat Balikpapan" maxLength={120} />
          </label>
          <label className="min-[700px]:w-44 text-xs font-medium text-app-muted">
            Masa berlaku
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hari</SelectItem>
                <SelectItem value="7">7 hari</SelectItem>
                <SelectItem value="30">30 hari</SelectItem>
                <SelectItem value="none">Tanpa batas waktu</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <Button type="submit" disabled={creating} className="min-h-11">
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Buat &amp; salin link
          </Button>
        </form>
      </Panel>

      <Panel>
        <PanelTitle hint={`${invites.length} link`}>Daftar link</PanelTitle>
        {loading ? (
          <Spinner />
        ) : invites.length === 0 ? (
          <EmptyState title="Belum ada link" icon={Link2}>Buat link pertama di atas.</EmptyState>
        ) : (
          <ul className="divide-y divide-app-border mt-2">
            {invites.map((inv) => {
              const st = statusOf(inv);
              return (
                <li key={inv.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="text-sm font-semibold text-app-ink truncate">{inv.label || 'Tanpa catatan'}</p>
                    <p className="text-xs text-app-muted">
                      Dibuat {fmt(inv.created_at)}
                      {st.key === 'used' && ` · dipakai ${fmt(inv.used_at)}${clinicNames[inv.used_clinic_id] ? ` oleh ${clinicNames[inv.used_clinic_id]}` : ''}`}
                      {st.key === 'active' && inv.expires_at && ` · berlaku s/d ${fmt(inv.expires_at)}`}
                    </p>
                  </div>
                  <Pill tone={st.tone}>{st.label}</Pill>
                  <div className="flex gap-1">
                    {st.key === 'active' && (
                      <>
                        <RowAction icon={Copy} label="Salin link" onClick={() => copy(inv.token)} />
                        <RowAction icon={Ban} label="Batalkan" tone="danger" onClick={() => revoke(inv)} />
                      </>
                    )}
                    {st.key !== 'active' && <RowAction icon={Trash2} label="Hapus" tone="danger" onClick={() => remove(inv)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
};

export default SuperAdminRegistrationLinks;
