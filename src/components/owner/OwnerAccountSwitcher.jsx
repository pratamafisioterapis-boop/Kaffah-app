import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, Loader2, Shield, Stethoscope, Crown } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const ADMIN_ROLES = ['admin', 'clinic_admin'];
const THERAPIST_ROLES = ['therapist', 'physiotherapist'];
const CACHE_KEY = 'owner_switcher_accounts';

const readCache = () => {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY)) || null; } catch { return null; }
};

// Lets an owner jump into any admin/therapist account of their own clinic;
// the dashboard then renders exactly as that account sees it.
const OwnerAccountSwitcher = ({ clinicId }) => {
  const { impersonateUser, stopImpersonation, user, isImpersonating, impersonationOrigin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 8, width: 300 });
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);

  useEffect(() => {
    if (!open || !clinicId) return;
    let active = true;
    // While impersonating, RLS may hide the clinic's users, so use the list
    // the owner's own session cached.
    const cached = isImpersonating ? readCache() : null;
    if (cached) {
      setAccounts(cached.filter((a) => a.id !== user?.id));
      return;
    }
    setLoading(true);
    // Therapist name comes from the physiotherapists table (the same
    // source as the Physiotherapist Management cards); the email stays the real login email from users.
    // users.* can be stale after a profile edit.
    Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, role, is_active')
        .eq('clinic_id', clinicId)
        .in('role', [...ADMIN_ROLES, ...THERAPIST_ROLES])
        .order('full_name'),
      supabase
        .from('physiotherapists')
        .select('user_id, name')
        .eq('clinic_id', clinicId)
        .not('user_id', 'is', null),
    ]).then(([{ data }, { data: physios }]) => {
      if (!active) return;
      const profileByUser = new Map((physios || []).map((p) => [p.user_id, p]));
      const list = (data || [])
        .filter((a) => a.is_active !== false)
        .map((a) => {
          const p = THERAPIST_ROLES.includes(a.role) ? profileByUser.get(a.id) : null;
          return p ? { ...a, full_name: p.name || a.full_name } : a;
        })
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      if (!isImpersonating) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
      }
      setAccounts(list.filter((a) => a.id !== user?.id));
      setLoading(false);
    });
    return () => { active = false; };
  }, [open, clinicId, user?.id, isImpersonating]);

  useEffect(() => {
    if (!open) return;
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

  // Render in a portal (fixed, anchored to the button) so no parent stacking
  // context or overflow can cover or clip the dropdown on mobile.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      // Clamp inside the visible viewport so the card never slips off-screen.
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(300, vw - 16);
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

  const handleSwitch = async (acc) => {
    setSwitchingId(acc.id);
    const { error } = await impersonateUser(acc.id);
    setSwitchingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal pindah akun', description: error.message });
      return;
    }
    setOpen(false);
    toast({ title: `Beralih ke ${acc.full_name || acc.email}` });
    navigate(ADMIN_ROLES.includes(acc.role) ? '/admin' : '/therapist', { replace: true });
  };

  const handleBackToOwner = async () => {
    setSwitchingId('owner');
    const { error } = await stopImpersonation();
    setSwitchingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal kembali ke Owner', description: error.message });
      return;
    }
    setOpen(false);
    navigate('/owner', { replace: true });
  };

  const groups = [
    ['Admin', Shield, accounts.filter((a) => ADMIN_ROLES.includes(a.role))],
    ['Terapis', Stethoscope, accounts.filter((a) => THERAPIST_ROLES.includes(a.role))],
  ];

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full sm:rounded-xl border border-[#DCE8F2] bg-white flex items-center justify-center text-[#102F52] hover:text-[#1677D2] hover:bg-[#F5F9FC] transition-colors shadow-sm"
        aria-label="Pindah akun"
        title="Pindah akun admin / terapis"
      >
        <Users className="w-3.5 h-3.5" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed bg-white border border-[#DCE8F2] rounded-xl shadow-lg z-[100] overflow-hidden"
        >
          <div className="px-4 pt-3 pb-2 border-b border-[#DCE8F2]">
            <p className="text-sm font-bold text-[#102F52]">Pindah Akun</p>
            <p className="text-xs text-[#5B6B7D]">Lihat tampilan sebagai admin / terapis klinik Anda</p>
          </div>
          <div className="max-h-[min(360px,60vh)] overflow-y-auto p-2">
            {isImpersonating && (
              <div className="mb-1">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#5B6B7D]">Owner</p>
                <button
                  onClick={handleBackToOwner}
                  disabled={switchingId !== null}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left disabled:opacity-60"
                >
                  <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0">
                    {switchingId === 'owner' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#102F52] truncate">Akun Owner</span>
                    <span className="block text-xs text-[#5B6B7D] truncate">{impersonationOrigin?.admin_email}</span>
                  </span>
                </button>
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#1677D2]" /></div>
            ) : accounts.length === 0 ? (
              <p className="text-xs text-[#5B6B7D] text-center py-6">Tidak ada akun lain.</p>
            ) : groups.map(([label, Icon, list]) => list.length > 0 && (
              <div key={label} className="mb-1">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#5B6B7D]">{label}</p>
                {list.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSwitch(a)}
                    disabled={switchingId !== null}
                    className={cn('w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left disabled:opacity-60')}
                  >
                    <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0">
                      {switchingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#102F52] truncate">{a.full_name || a.email}</span>
                      <span className="block text-xs text-[#5B6B7D] truncate">{a.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OwnerAccountSwitcher;
