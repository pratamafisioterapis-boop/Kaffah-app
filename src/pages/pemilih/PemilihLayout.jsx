import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { PEMILIH_SHARED_CSS } from './pemilihSharedStyles';

const NAV = [
  { to: '/pemilih/dashboard', label: 'Dashboard', icon: '📊', full: 'Dashboard & Strategi' },
  { to: '/pemilih/upload-ktp', label: 'Scan KTP', icon: '🪪', full: 'Scan / Upload KTP' },
  { to: '/pemilih/data', label: 'Data Pemilih', icon: '👥', full: 'Data Pemilih' },
  { to: '/pemilih/data-dpt', label: 'Data DPT', icon: '🗳️', full: 'Data Pemilih Sebelumnya (DPT)' },
  { to: '/pemilih/suara-pks', label: 'Suara PKS', icon: '🌿', full: 'Perolehan Suara PKS' },
  { to: '/pemilih/tim-sukses', label: 'Tim Sukses', icon: '🤝', full: 'Tim Sukses & Relawan' },
  { to: '/pemilih/kegiatan', label: 'Kegiatan', icon: '📝', full: 'Log Kegiatan' },
  { to: '/pemilih/extract-pdf', label: 'Ekstrak PDF', icon: '📄', full: 'Ekstrak Data dari PDF' },
  { to: '/pemilih/setup', label: 'Setup', icon: '⚙️', full: 'Setup & Pengaturan' },
];

const CSS = `
  ${PEMILIH_SHARED_CSS}
  :root {
    --sidebar-w: 252px;
  }
  .pmh-wrapper {
    display: flex; min-height: 100vh; min-height: 100dvh;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--p-bg); color: var(--p-text);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Sidebar ─────────────────────────────────────────────────────── */
  .pmh-sidebar {
    width: var(--sidebar-w); flex-shrink: 0;
    background: linear-gradient(165deg, #17181f 0%, #0d0e13 100%);
    display: flex; flex-direction: column;
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
    border-right: 1px solid rgba(255,255,255,0.05);
    box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  }
  .pmh-brand { padding: 26px 22px 22px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .pmh-brand-icon {
    width: 42px; height: 42px; border-radius: 13px;
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
    box-shadow: 0 6px 16px rgba(220,38,38,0.35), inset 0 1px 1px rgba(255,255,255,0.2);
  }
  .pmh-brand-text { font-weight: 800; font-size: 14.5px; color: #fff; line-height: 1.3; letter-spacing: -0.01em; }
  .pmh-brand-sub { font-size: 10.5px; color: #71717a; font-weight: 500; margin-top: 1px; }

  .pmh-nav { padding: 18px 12px; flex: 1; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
  .pmh-nav-label { font-size: 10px; font-weight: 700; color: #52525b; text-transform: uppercase; letter-spacing: 0.08em; padding: 10px 12px 6px; }
  .pmh-navlink {
    display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 11px;
    color: #a1a1aa; text-decoration: none; font-size: 13.5px; font-weight: 500;
    transition: all 0.18s cubic-bezier(.4,0,.2,1); position: relative;
  }
  .pmh-navlink:hover { background: rgba(255,255,255,0.05); color: #f4f4f5; transform: translateX(2px); }
  .pmh-navlink.active {
    background: linear-gradient(135deg, rgba(239,68,68,0.16), rgba(185,28,28,0.10));
    color: #fca5a5; font-weight: 700;
    box-shadow: inset 0 0 0 1px rgba(239,68,68,0.25);
  }
  .pmh-navlink.active::before {
    content: ''; position: absolute; left: -12px; top: 50%; transform: translateY(-50%);
    width: 3px; height: 18px; background: linear-gradient(180deg, #f87171, #dc2626); border-radius: 0 3px 3px 0;
  }
  .pmh-navlink .nav-icon { font-size: 17px; width: 20px; text-align: center; filter: grayscale(0.15); }

  .pmh-sidebar-footer { padding: 14px 12px 22px; border-top: 1px solid rgba(255,255,255,0.06); }
  .pmh-logout {
    width: 100%; padding: 11px 13px; border-radius: 11px; border: 1px solid rgba(248,113,113,0.18);
    background: rgba(248,113,113,0.06); color: #f87171; cursor: pointer; font-size: 13px; font-weight: 600;
    transition: all 0.18s; display: flex; align-items: center; gap: 9px;
  }
  .pmh-logout:hover { background: rgba(239,68,68,0.14); border-color: rgba(248,113,113,0.35); }

  /* ── Main content ────────────────────────────────────────────────── */
  .pmh-main { margin-left: var(--sidebar-w); flex: 1; min-width: 0; padding: 36px 44px 48px; }

  .pmh-topbar {
    display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    background: rgba(13,14,19,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    height: 58px; align-items: center; justify-content: space-between; padding: 0 18px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .pmh-topbar-brand { font-weight: 800; font-size: 14.5px; color: #fff; letter-spacing: -0.01em; }
  .pmh-topbar-page { font-size: 11px; color: #71717a; margin-top: 1px; }
  .pmh-hamburger {
    width: 38px; height: 38px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06); color: #fff; display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 18px;
  }

  .pmh-overlay { display: none; position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.65); backdrop-filter: blur(2px); }
  .pmh-overlay.open { display: block; }
  .pmh-drawer {
    position: fixed; top: 0; left: 0; bottom: 0; width: 270px; z-index: 70;
    background: linear-gradient(165deg, #17181f 0%, #0d0e13 100%);
    transform: translateX(-100%); transition: transform 0.28s cubic-bezier(.4,0,.2,1);
    display: flex; flex-direction: column; box-shadow: 8px 0 32px rgba(0,0,0,0.3);
  }
  .pmh-drawer.open { transform: translateX(0); }
  .pmh-drawer-header { padding: 22px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
  .pmh-drawer-close {
    width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06); color: #a1a1aa; display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 14px;
  }
  .pmh-drawer-nav { padding: 14px 12px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .pmh-drawer-footer { padding: 14px 12px 26px; border-top: 1px solid rgba(255,255,255,0.08); }

  @media (max-width: 768px) {
    .pmh-sidebar { display: none; }
    .pmh-topbar { display: flex; }
    .pmh-main { margin-left: 0 !important; padding: 74px 16px 40px; }
    .pmh-overlay { align-items: flex-end; padding: 0; }
  }
  @media (min-width: 769px) and (max-width: 1100px) {
    :root { --sidebar-w: 210px; }
    .pmh-main { padding: 28px 26px 40px; }
  }
  @media (display-mode: standalone) {
    .pmh-topbar { padding-top: env(safe-area-inset-top,0); height: calc(58px + env(safe-area-inset-top,0)); }
    .pmh-main { padding-top: calc(74px + env(safe-area-inset-top,0)); }
    .pmh-main { padding-bottom: calc(48px + env(safe-area-inset-bottom,0)); }
    .pmh-drawer { padding-bottom: env(safe-area-inset-bottom,0); }
  }
`;

const PemilihLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // PWA: ganti warna status bar HP jadi merah selama di modul ini,
  // kembalikan ke warna asli (navy klinik) saat keluar dari modul.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const originalColor = meta?.getAttribute('content');
    if (meta) meta.setAttribute('content', '#0d0e13');
    return () => {
      if (meta && originalColor) meta.setAttribute('content', originalColor);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const currentNav = NAV.find((n) => location.pathname === n.to || location.pathname.startsWith(n.to + '/'));

  return (
    <>
      <style>{CSS}</style>
      <div className="pmh-wrapper">
        <aside className="pmh-sidebar">
          <div className="pmh-brand">
            <div className="pmh-brand-icon">🗳️</div>
            <div>
              <div className="pmh-brand-text">Data Pemilih</div>
              <div className="pmh-brand-sub">Balikpapan Utara</div>
            </div>
          </div>
          <nav className="pmh-nav p-scrollbar">
            <div className="pmh-nav-label">Menu Utama</div>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'pmh-navlink' + (isActive ? ' active' : '')}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.full}
              </NavLink>
            ))}
          </nav>
          <div className="pmh-sidebar-footer">
            <button onClick={handleLogout} className="pmh-logout">
              <span>🚪</span> Keluar
            </button>
          </div>
        </aside>

        <div className="pmh-topbar">
          <div>
            <div className="pmh-topbar-brand">🗳️ Data Pemilih</div>
            {currentNav && <div className="pmh-topbar-page">{currentNav.full}</div>}
          </div>
          <button className="pmh-hamburger" onClick={() => setMenuOpen(true)} aria-label="Buka menu">☰</button>
        </div>

        <div className={'pmh-overlay' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)}>
          <div className={'pmh-drawer' + (menuOpen ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
            <div className="pmh-drawer-header">
              <div className="pmh-brand-text">🗳️ Data Pemilih</div>
              <button className="pmh-drawer-close" onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <nav className="pmh-drawer-nav">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => 'pmh-navlink' + (isActive ? ' active' : '')}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.full}
                </NavLink>
              ))}
            </nav>
            <div className="pmh-drawer-footer">
              <button onClick={handleLogout} className="pmh-logout">
                <span>🚪</span> Keluar
              </button>
            </div>
          </div>
        </div>

        <main className="pmh-main">{children}</main>
      </div>
    </>
  );
};

export default PemilihLayout;