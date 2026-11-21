import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, Loader2, Crown, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';

// Topbar "Pindah akun" for the super admin: jump into any owner's account.
// From there the owner's own switcher still reaches admin / terapis.
const SuperAdminAccountSwitcher = () => {
  const { impersonateUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 8, width: 320 });
  const [open, setOpen] = useState(false);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [query, setQuery] = useState('');

  // Muat daftar owner sejak topbar tampil, bukan saat dropdown dibuka.
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from('users').select('id, full_name, email, clinic_id, is_active').eq('role', 'owner').order('full_name'),
      supabase.from('clinics').select('id, name'),
    ]).then(([{ data: users }, { data: clinics }]) => {
      if (!active) return;
      const clinicName = new Map((clinics || []).map((c) => [c.id, c.name]));
      setOwners(
        (users || [])
          .filter((u) => u.is_active !== false)
          .map((u) => ({ ...u, clinic_name: clinicName.get(u.clinic_id) || 'Tanpa klinik' }))
          .sort((a, b) => a.clinic_name.localeCompare(b.clinic_name) || (a.full_name || '').localeCompare(b.full_name || ''))
      );
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(320, vw - 16);
      const left = Math.min(Math.max(8, r.right - width), vw - width - 8);
      setPos({ top: r.bottom + 8, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return owners;
    return owners.filter((o) => `${o.full_name} ${o.email} ${o.clinic_name}`.toLowerCase().includes(q));
  }, [owners, query]);

  const handleSwitch = async (owner) => {
    setSwitchingId(owner.id);
    // Unduh kode dashboard owner sambil menunggu sesi remote dibuat.
    import('@/pages/OwnerDashboard').catch(() => {});
    const { error } = await impersonateUser(owner.id);
    setSwitchingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal pindah akun', description: error.message });
      return;
    }
    setOpen(false);
    toast({ title: `Beralih ke ${owner.full_name || owner.email}` });
    navigate('/owner', { replace: true });
  };

  return (
    <div className="relative flex-shrink-0 ml-auto" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full border border-app-border bg-white flex items-center justify-center text-app-ink hover:text-app-accent hover:bg-[#F5F9FC] transition-colors shadow-sm"
        aria-label="Pindah akun"
        title="Pindah akun owner"
      >
        <Users className="w-3.5 h-3.5" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed bg-white border border-app-border rounded-app shadow-lg z-[100] overflow-hidden"
        >
          <div className="px-4 pt-3 pb-2 border-b border-app-border">
            <p className="text-sm font-bold text-app-ink">Pindah Akun</p>
            <p className="text-xs text-app-muted">Lihat tampilan sebagai owner klinik</p>
            <div className="relative mt-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari owner atau klinik"
                className="w-full h-9 pl-8 pr-2 text-sm rounded-app-sm border border-app-border outline-none focus:border-app-accent"
              />
            </div>
          </div>
          <div className="max-h-[min(360px,60vh)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-app-accent" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-app-muted text-center py-6">Owner tidak ditemukan.</p>
            ) : filtered.map((o, i) => (
              <div key={o.id}>
                {(i === 0 || filtered[i - 1].clinic_name !== o.clinic_name) && (
                  <p className="px-2 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-app-muted break-words">{o.clinic_name}</p>
                )}
                <button
                  type="button"
                  onClick={() => handleSwitch(o)}
                  disabled={switchingId !== null}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-app-sm hover:bg-[#F5F9FC] text-left disabled:opacity-60"
                >
                  <span className="w-8 h-8 rounded-full bg-app-soft flex items-center justify-center text-app-accent flex-shrink-0">
                    {switchingId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-app-ink break-words sm:truncate">{o.full_name || o.email}</span>
                    <span className="block text-xs text-app-muted break-words sm:truncate">{o.email}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SuperAdminAccountSwitcher;
