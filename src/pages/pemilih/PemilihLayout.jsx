import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

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
  :root {
    --sidebar-w: 252px;
    --p-red: #dc2626;
    --p-red-dark: #991b1b;
    --p-red-light: #fef2f2;
    --p-bg: #f4f5f7;
    --p-card: #ffffff;
    --p-border: #e8e9ec;
    --p-text: #1a1d29;
    --p-text-soft: #6b7280;
    --p-shadow-sm: 0 1px 2px rgba(16,24,40,0.05);
    --p-shadow-md: 0 4px 12px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08);
    --p-shadow-lg: 0 12px 32px rgba(16,24,40,0.10), 0 2px 8px rgba(16,24,40,0.06);
    --p-radius: 16px;
    --p-radius-sm: 10px;
  }
  *, *::before, *::after { box-sizing: border-box; }
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

  /* ── Shared UI primitives (dipakai semua halaman) ───────────────────── */
  .p-card {
    background: var(--p-card); border-radius: var(--p-radius);
    border: 1px solid var(--p-border); box-shadow: var(--p-shadow-md);
    transition: box-shadow 0.2s;
  }
  .p-card-hover:hover { box-shadow: var(--p-shadow-lg); }

  .p-page-title { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: var(--p-text); letter-spacing: -0.02em; }
  .p-page-subtitle { color: var(--p-text-soft); margin-top: 0; margin-bottom: 26px; font-size: 14px; }

  .p-btn-primary {
    padding: 10px 20px; background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff; border: none; border-radius: 12px; cursor: pointer;
    font-weight: 700; font-size: 13.5px; white-space: nowrap;
    box-shadow: 0 4px 14px rgba(220,38,38,0.3), inset 0 1px 1px rgba(255,255,255,0.15);
    transition: all 0.18s cubic-bezier(.4,0,.2,1);
    display: inline-flex; align-items: center; gap: 7px;
  }
  .p-btn-primary:hover { transform: translateY(-1.5px); box-shadow: 0 8px 20px rgba(220,38,38,0.4); }
  .p-btn-primary:active { transform: translateY(0); }
  .p-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }

  .p-btn-ghost {
    padding: 9px 16px; background: #fff; color: var(--p-text);
    border: 1px solid var(--p-border); border-radius: 11px; cursor: pointer;
    font-weight: 600; font-size: 13px; transition: all 0.16s;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .p-btn-ghost:hover { background: #f9fafb; border-color: #d1d5db; }
  .p-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

  .p-input, .p-select {
    width: 100%; padding: 10px 13px; border-radius: 11px; border: 1.5px solid var(--p-border);
    font-size: 13.5px; color: var(--p-text); background: #fff;
    transition: all 0.16s; font-family: inherit;
  }
  .p-input:focus, .p-select:focus {
    outline: none; border-color: #dc2626; box-shadow: 0 0 0 3.5px rgba(220,38,38,0.1);
  }
  .p-input::placeholder { color: #a1a1aa; }
  .p-input:disabled, .p-select:disabled { background: #f4f5f7; color: #9ca3af; }

  .p-label { font-size: 12px; font-weight: 600; color: #4b5563; margin-bottom: 5px; display: block; }

  .p-badge {
    padding: 4px 11px; border-radius: 999px; font-size: 11px; font-weight: 700;
    display: inline-flex; align-items: center; gap: 4px;
  }

  .p-modal-overlay {
    position: fixed; inset: 0; background: rgba(15,17,23,0.6); backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px;
    animation: p-fade-in 0.15s ease-out;
  }
  .p-modal {
    background: #fff; border-radius: 20px; box-shadow: var(--p-shadow-lg);
    animation: p-scale-in 0.18s cubic-bezier(.4,0,.2,1);
    max-height: 90vh; overflow-y: auto;
  }
  @keyframes p-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes p-scale-in { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }

  .p-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .p-table thead tr { background: #fafafa; border-bottom: 1.5px solid var(--p-border); }
  .p-table th { text-align: left; padding: 12px 14px; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
  .p-table td { padding: 13px 14px; border-bottom: 1px solid #f1f1f3; }
  .p-table tbody tr { transition: background 0.12s; }
  .p-table tbody tr:hover { background: #fafafa; }

  /* Wrapper wajib dipakai di sekeliling <table> agar tabel bisa di-scroll horizontal, bukan mendorong layout melebar di layar HP/PWA */
  .p-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

  /* Pasangan kelas untuk tabel (desktop) vs kartu (mobile) — dipakai bareng supaya
     daftar panjang tidak perlu di-swipe horizontal di layar HP/PWA */
  .p-mobile-only { display: none; }
  .p-desktop-only { display: block; }

  /* Grid yang otomatis menjadi 1 kolom di layar sempit (form & panel berdampingan) */
  .p-grid-collapse { min-width: 0; }
  .p-grid-collapse > * { min-width: 0; }

  .p-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
  .p-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 8px; }
  .p-scrollbar::-webkit-scrollbar-track { background: transparent; }

  @media (max-width: 768px) {
    .pmh-sidebar { display: none; }
    .pmh-topbar { display: flex; }
    .pmh-main { margin-left: 0 !important; padding: 74px 16px 40px; }
    .pmh-overlay { align-items: flex-end; padding: 0; }
    .p-page-title { font-size: 20px; }
    .p-grid-collapse { grid-template-columns: 1fr !important; }
    .p-modal-overlay { align-items: flex-end; padding: 0; }
    .p-modal { width: 100% !important; max-width: 100% !important; border-radius: 20px 20px 0 0 !important; max-height: 92vh; }
    .p-table th, .p-table td { padding: 10px 11px; font-size: 12.5px; }
    .p-mobile-only { display: block; }
    .p-desktop-only { display: none; }
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
    .p-modal-overlay { padding-bottom: calc(20px + env(safe-area-inset-bottom,0)); }
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