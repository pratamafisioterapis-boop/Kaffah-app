import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Eye, Users, CreditCard, BookOpen, ShieldCheck, LogOut, MoreHorizontal, X, PlayCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Menu super admin. `tab` = tampil di bar bawah (mobile); sisanya masuk "Lainnya".
const NAV = [
  { label: 'Ringkasan', short: 'Ringkasan', path: '/super-admin/overview', icon: LayoutDashboard, tab: true },
  { group: 'Klinik' },
  { label: 'Manajemen Klinik', short: 'Klinik', path: '/super-admin/clinics', icon: Building2, tab: true },
  { label: 'Lihat Data Klinik', short: 'Data', path: '/super-admin/clinic-viewer', icon: Eye },
  { group: 'Akses & Tagihan' },
  { label: 'Manajemen User', short: 'User', path: '/super-admin/users', icon: Users, tab: true },
  { label: 'Langganan', short: 'Langganan', path: '/super-admin/subscriptions', icon: CreditCard, tab: true },
  { group: 'Clinara Pasien' },
  { label: 'Video Latihan', short: 'Video', path: '/super-admin/exercise-videos', icon: PlayCircle },
  { group: 'Asisten AI' },
  { label: 'Basis Jurnal AI', short: 'Jurnal AI', path: '/super-admin/journal-knowledge-base', icon: BookOpen },
];
const ITEMS = NAV.filter((n) => n.path);

// Layar: <700 bar bawah | 700-1099 rail ikon | >=1100 sidebar penuh.
const SuperAdminLayout = ({ children, userName = 'Super Admin' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, userDetails } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const current = ITEMS.find((i) => location.pathname.startsWith(i.path)) || ITEMS[0];
  const email = userDetails?.email || '';

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: 'Anda sudah keluar' });
    } catch (error) {
      console.error('Logout error:', error);
      toast({ variant: 'destructive', title: 'Keluar dari perangkat ini', description: 'Sesi dihapus di perangkat ini.' });
    }
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 min-h-11 text-sm font-medium transition-colors active:scale-[0.98]',
      'min-[700px]:max-[1099px]:flex-col min-[700px]:max-[1099px]:justify-center min-[700px]:max-[1099px]:gap-0.5 min-[700px]:max-[1099px]:min-h-14 min-[700px]:max-[1099px]:px-1 min-[700px]:max-[1099px]:text-center',
      isActive ? 'bg-app-soft text-app-accent font-semibold' : 'text-app-muted hover:bg-slate-50 hover:text-app-ink'
    );

  const tabs = ITEMS.filter((i) => i.tab);
  const moreActive = !tabs.some((t) => t.path === current.path);

  return (
    <div className="min-h-dvh bg-[#F5F9FC] text-app-ink" style={{ fontFamily: 'var(--app-font, inherit)' }}>
      {/* Sidebar (>=1100) / rail ikon (700-1099) */}
      <aside className="hidden min-[700px]:flex fixed inset-y-0 left-0 z-30 flex-col bg-white border-r border-app-border min-[700px]:w-[84px] min-[1100px]:w-[264px]">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 min-[700px]:max-[1099px]:justify-center min-[700px]:max-[1099px]:px-2">
          <span className="w-10 h-10 rounded-xl bg-app-soft text-app-accent grid place-items-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div className="min-[700px]:max-[1099px]:hidden leading-tight">
            <p className="font-semibold text-base">Super Admin</p>
            <p className="text-xs text-app-muted">Kontrol sistem</p>
          </div>
        </div>
        <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-0.5 min-[700px]:max-[1099px]:gap-1 min-[700px]:max-[1099px]:px-2">
          {NAV.map((n, i) =>
            n.group ? (
              <p key={i} className="min-[700px]:max-[1099px]:hidden px-2.5 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-app-muted">{n.group}</p>
            ) : (
              <NavLink key={n.path} to={n.path} className={linkClass}>
                <n.icon className="w-5 h-5 shrink-0" />
                <span className="min-[700px]:max-[1099px]:hidden">{n.label}</span>
                <span className="hidden min-[700px]:max-[1099px]:block text-[10.5px] leading-tight font-medium">{n.short}</span>
              </NavLink>
            )
          )}
        </nav>
        <div className="border-t border-app-border p-3 flex flex-col gap-1">
          <div className="flex items-center gap-2.5 px-2 py-1.5 min-w-0 min-[700px]:max-[1099px]:justify-center">
            <span className="w-9 h-9 rounded-full bg-app-accent text-white grid place-items-center text-[13px] font-semibold shrink-0">SA</span>
            <div className="min-w-0 min-[700px]:max-[1099px]:hidden">
              <p className="text-[13px] font-semibold truncate">{typeof userName === 'string' ? userName : 'Super Admin'}</p>
              <p className="text-xs text-app-muted truncate">{email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Keluar aplikasi"
            className="flex items-center gap-3 rounded-xl px-3 min-h-11 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors min-[700px]:max-[1099px]:justify-center"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="min-[700px]:max-[1099px]:hidden">Keluar aplikasi</span>
          </button>
        </div>
      </aside>

      <div className="min-[700px]:ml-[84px] min-[1100px]:ml-[264px] min-h-dvh flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 min-[700px]:px-6 h-14 bg-[#F5F9FC]/90 backdrop-blur border-b border-app-border pt-[env(safe-area-inset-top)] box-content">
          <span className="min-[700px]:hidden w-8 h-8 rounded-lg bg-app-soft text-app-accent grid place-items-center shrink-0">
            <ShieldCheck className="w-[18px] h-[18px]" />
          </span>
          <p className="text-[15px] min-[700px]:text-[13px] min-w-0 truncate text-app-muted">
            <span className="max-[699px]:hidden">Super Admin / </span>
            <span className="font-semibold text-app-ink">{current.label}</span>
          </p>
        </header>

        <main className="flex-1 min-w-0 px-4 py-5 pb-28 min-[700px]:px-6 min-[700px]:py-6 min-[700px]:pb-10 min-[1100px]:px-8 min-[1100px]:py-7">
          <div key={location.pathname} className="w-full max-w-[1180px] mx-auto flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-1 duration-200">
            {children}
          </div>
        </main>
      </div>

      {/* Bar bawah (mobile) */}
      <nav
        aria-label="Menu cepat"
        className="min-[700px]:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 gap-0.5 bg-white border-t border-app-border px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            className={({ isActive }) =>
              cn('flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl text-[11px] font-medium transition active:scale-95',
                isActive ? 'bg-app-soft text-app-accent font-semibold' : 'text-app-muted')
            }
          >
            <t.icon className="w-5 h-5" />
            {t.short}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-current={moreActive ? 'page' : undefined}
          className={cn('flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl text-[11px] font-medium transition active:scale-95',
            moreActive ? 'bg-app-soft text-app-accent font-semibold' : 'text-app-muted')}
        >
          <MoreHorizontal className="w-5 h-5" />
          Lainnya
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)} className="min-[700px]:hidden fixed inset-0 z-50 bg-slate-900/50"
            />
            <motion.div
              key="sheet" role="dialog" aria-modal="true" aria-label="Menu lainnya"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="min-[700px]:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center justify-between px-3 pb-2">
                <h2 className="font-semibold">Menu lainnya</h2>
                <button type="button" aria-label="Tutup" onClick={() => setMoreOpen(false)} className="w-11 h-11 grid place-items-center rounded-xl text-app-muted active:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {ITEMS.filter((i) => !i.tab).map((i) => (
                <NavLink
                  key={i.path} to={i.path} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => cn('flex items-center gap-4 px-3 min-h-[52px] rounded-xl font-medium', isActive ? 'bg-app-soft text-app-accent' : 'text-app-ink')}
                >
                  <i.icon className="w-5 h-5" /> {i.label}
                </NavLink>
              ))}
              <button
                type="button" onClick={() => { setMoreOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-4 px-3 min-h-[52px] rounded-xl font-medium text-red-700"
              >
                <LogOut className="w-5 h-5" /> Keluar aplikasi
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SuperAdminLayout;
