import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import DashboardTopbar from '@/components/DashboardTopbar';
import { cn } from '@/lib/utils';

// Kerangka halaman akun terapis: rail ikon di desktop (melebar saat disorot), tab bar bawah
// dengan tombol Menu di tengah di HP. Daftar menu, filter fitur klinik, dan aksinya tetap
// dihitung oleh DashboardLayout; komponen ini hanya mengatur tampilan.

const PRIMARY_TABS = ['/therapist', '/therapist/booking', '/therapist/appointments', '/therapist/records'];
const SHORT_LABEL = { Dashboard: 'Beranda', 'Booking Calendar': 'Kalender', 'Riwayat Pasien': 'Riwayat', 'Evaluasi Pasien': 'Evaluasi' };

const groupOf = (item) => {
  if (['/therapist/clinara-pasien', '/therapist/decrees'].includes(item.path)) return 'Komunikasi';
  if (['/therapist/leave', '/therapist/remuneration', '/therapist/drive-upload'].includes(item.path)) return 'Administrasi';
  if (item.path === '#settings') return 'Akun';
  return 'Praktik';
};
const GROUP_ORDER = ['Praktik', 'Komunikasi', 'Administrasi', 'Akun'];

const initialsOf = (name) => String(name || 'T').split(',')[0].trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const TherapistShell = ({ navItems, iconMap, userName, clinicInfo, clinicId, onLogout, topSlot, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [railPinned, setRailPinned] = useState(false);
  const iconFor = (item) => iconMap[item.icon] || iconMap.Home;

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const isActive = (item) => (item.path === '/therapist'
    ? location.pathname === '/therapist' || location.pathname === '/therapist/'
    : location.pathname.startsWith(item.path));

  const go = (item) => {
    setMenuOpen(false);
    if (item.onClick) item.onClick(); else navigate(item.path);
  };

  const tabs = useMemo(() => {
    const picked = PRIMARY_TABS.map((p) => navItems.find((i) => i.path === p)).filter(Boolean);
    return picked.length >= 4 ? picked : [...picked, ...navItems.filter((i) => !picked.includes(i) && !i.onClick)].slice(0, 4);
  }, [navItems]);

  const groups = GROUP_ORDER
    .map((g) => ({ name: g, items: navItems.filter((i) => groupOf(i) === g) }))
    .filter((g) => g.items.length > 0);

  const railItemClass = (active) => cn(
    'relative flex h-11 shrink-0 items-center gap-3.5 rounded-app px-[15px] text-sm font-semibold transition-colors',
    active ? 'bg-app-soft text-app-accent' : 'text-app-muted hover:bg-slate-50 hover:text-app-accent',
  );
  const railLabel = 'whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100';
  const pinned = railPinned ? 'w-[248px] shadow-2xl [&_.rail-label]:opacity-100' : 'w-[76px]';

  const renderTab = (item) => {
    const Icon = iconFor(item);
    const active = isActive(item);
    return (
      <button
        key={item.path}
        type="button"
        onClick={() => go(item)}
        aria-current={active ? 'page' : undefined}
        className={cn('relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold', active ? 'text-app-accent' : 'text-app-muted')}
      >
        {active && <motion.span layoutId="tab-ind" className="absolute -top-1.5 h-1 w-6 rounded-b bg-app-accent" />}
        <Icon className="h-[22px] w-[22px]" />
        {SHORT_LABEL[item.label] || item.label}
      </button>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F5F9FC]" style={{ fontFamily: 'var(--app-font, inherit)' }}>
      {/* Rail desktop */}
      <aside
        className={cn('group fixed inset-y-0 left-0 z-50 hidden flex-col gap-1 overflow-hidden border-r border-app-border bg-white px-3 py-3.5 transition-[width,box-shadow] duration-300 lg:flex hover:w-[248px] hover:shadow-2xl focus-within:w-[248px]', pinned)}
        aria-label="Menu utama"
      >
        <button type="button" onClick={() => setRailPinned((v) => !v)} className="mb-2 flex h-12 shrink-0 items-center gap-3 rounded-app text-left" aria-label="Lebarkan atau ciutkan menu" aria-pressed={railPinned}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-app border border-app-border bg-white">
            {clinicInfo?.logo_url
              ? <img src={clinicInfo.logo_url} alt="" className="h-full w-full object-contain p-1" />
              : <span className="text-lg font-extrabold text-app-accent">{(clinicInfo?.name || 'K').charAt(0)}</span>}
          </span>
          <span className={cn('rail-label min-w-0', railLabel)}>
            <span className="block truncate text-sm font-extrabold leading-tight text-app-ink">{clinicInfo?.name || 'Klinik'}</span>
            <span className="block text-xs font-medium text-app-muted">Akun terapis</span>
          </span>
        </button>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = iconFor(item);
            const active = isActive(item);
            const inner = (
              <>
                {active && <span className="absolute -left-3 bottom-2.5 top-2.5 w-1 rounded-r bg-app-accent" />}
                <Icon className="h-5 w-5 shrink-0" />
                <span className={cn('rail-label', railLabel)}>{item.label}</span>
              </>
            );
            return item.onClick ? (
              <button key={item.label} type="button" title={item.label} onClick={() => item.onClick()} className={cn(railItemClass(false), 'text-left')}>{inner}</button>
            ) : (
              <NavLink key={item.path} to={item.path} end={item.path === '/therapist'} title={item.label} className={railItemClass(active)} aria-current={active ? 'page' : undefined}>{inner}</NavLink>
            );
          })}
        </nav>

        <div className="mt-1 flex shrink-0 flex-col gap-1 border-t border-app-border pt-2">
          <div className="flex h-11 items-center gap-3.5 px-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-accent text-xs font-extrabold text-white">{initialsOf(userName)}</span>
            <span className={cn('rail-label min-w-0', railLabel)}>
              <span className="block truncate text-[13px] font-bold leading-tight text-app-ink">{typeof userName === 'string' ? userName.split(',')[0] : 'Terapis'}</span>
              <span className="block text-xs text-app-muted">Fisioterapis</span>
            </span>
          </div>
          <button type="button" onClick={onLogout} title="Keluar Aplikasi" className={cn(railItemClass(false), 'text-red-500 hover:bg-red-50 hover:text-red-600')}>
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn('rail-label', railLabel)}>Keluar Aplikasi</span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen w-full max-w-full lg:pl-[76px]">
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-2 sm:px-8 sm:pt-4 lg:pb-10">
          <div className="sticky top-0 z-40">
            <DashboardTopbar role="therapist" userName={userName} clinicName={clinicInfo?.name || ''} navItems={navItems} clinicId={clinicId} />
            {topSlot}
          </div>
          {children}
        </div>
      </main>

      {/* Menu lengkap (HP) */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[55] bg-slate-900/45 backdrop-blur-sm lg:hidden" />
            <motion.div
              key="sheet"
              role="dialog"
              aria-label="Semua menu"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-[56] max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-28 pt-4 shadow-2xl lg:hidden"
            >
              <h2 className="mx-1 text-lg font-extrabold text-app-ink">Semua menu</h2>
              {groups.map((g) => (
                <div key={g.name}>
                  <p className="mx-1 mb-2 mt-4 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-app-muted">{g.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map((item, idx) => {
                      const Icon = iconFor(item);
                      const active = isActive(item);
                      return (
                        <motion.button
                          key={item.label}
                          type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 + idx * 0.03 }}
                          onClick={() => go(item)}
                          className={cn('flex items-center gap-2.5 rounded-app border p-2.5 text-left text-[13.5px] font-semibold leading-tight active:scale-95', active ? 'border-app-accent bg-app-soft text-app-accent' : 'border-app-border bg-[#F5F9FC] text-app-ink')}
                        >
                          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-app-sm', active ? 'bg-app-accent text-white' : 'bg-app-soft text-app-accent')}><Icon className="h-[19px] w-[19px]" /></span>
                          {item.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => { setMenuOpen(false); onLogout(); }} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-app bg-red-50 text-sm font-bold text-red-600">
                <LogOut className="h-[18px] w-[18px]" /> Keluar Aplikasi
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tab bar bawah (HP) */}
      <nav className="fixed inset-x-0 bottom-0 z-[60] flex items-end justify-around rounded-t-3xl border-t border-app-border bg-white px-1.5 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-1.5 shadow-[0_-10px_30px_-20px_rgba(10,40,60,0.5)] lg:hidden" aria-label="Menu utama">
        {tabs.slice(0, 2).map(renderTab)}
        <div className="flex min-w-0 flex-1 justify-center">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Semua menu"
            aria-expanded={menuOpen}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-[#F5F9FC] bg-gradient-to-br from-app-accent-hover to-app-accent-bright text-white shadow-lg transition-transform active:scale-95"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {tabs.slice(2, 4).map(renderTab)}
      </nav>
    </div>
  );
};

export default TherapistShell;
