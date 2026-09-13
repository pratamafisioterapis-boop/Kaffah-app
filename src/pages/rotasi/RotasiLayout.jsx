import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const NAV = [
  { to: '/rotasi/jadwal',      label: 'Jadwal',    icon: '📅', full: 'Jadwal Hari Ini' },
  { to: '/rotasi/riwayat',     label: 'Riwayat',   icon: '📋', full: 'Riwayat'         },
  { to: '/rotasi/pasien',      label: 'Pasien',    icon: '👤', full: 'Pasien'          },
  { to: '/rotasi/terapis',     label: 'Terapis',   icon: '🏥', full: 'Terapis'         },
  { to: '/rotasi/template-wa', label: 'Template',  icon: '💬', full: 'Template WA'     },
  { to: '/rotasi/setup',       label: 'Setup',     icon: '⚙️', full: 'Setup'           },
];

const CSS = `
  :root { --sidebar-w: 240px; }
  *, *::before, *::after { box-sizing: border-box; }
  .rotasi-wrapper { display: flex; min-height: 100vh; min-height: 100dvh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #f1f5f9; }
  .rotasi-sidebar { width: var(--sidebar-w); flex-shrink: 0; background: linear-gradient(180deg,#0f172a 0%,#1e293b 100%); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 40; border-right: 1px solid rgba(255,255,255,0.06); }
  .rotasi-brand { padding: 20px 20px 0; display: flex; align-items: center; gap: 10px; }
  .rotasi-brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg,#3b82f6,#2563eb); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
  .rotasi-brand-text { font-weight: 800; font-size: 13px; color: #fff; line-height: 1.3; }
  .rotasi-brand-sub { font-size: 10px; color: #64748b; font-weight: 500; }
  .rotasi-nav { padding: 24px 12px; flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .rotasi-navlink { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; color: #94a3b8; text-decoration: none; font-size: 13.5px; font-weight: 500; transition: all 0.15s; }
  .rotasi-navlink:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
  .rotasi-navlink.active { background: linear-gradient(135deg,#2563eb,#1d4ed8); color: #fff; font-weight: 700; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
  .rotasi-navlink .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .rotasi-sidebar-footer { padding: 12px 12px 20px; border-top: 1px solid rgba(255,255,255,0.06); }
  .rotasi-logout { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(248,113,113,0.3); background: transparent; color: #f87171; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; display: flex; align-items: center; gap: 8px; }
  .rotasi-logout:hover { background: rgba(239,68,68,0.1); border-color: #f87171; }
  .rotasi-main { margin-left: var(--sidebar-w); flex: 1; min-width: 0; padding: 32px 40px 40px; }
  .rotasi-topbar { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: #0f172a; height: 56px; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .rotasi-topbar-brand { font-weight: 800; font-size: 14px; color: #fff; }
  .rotasi-topbar-page { font-size: 11px; color: #64748b; }
  .rotasi-hamburger { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; }
  .rotasi-bottomnav { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: #0f172a; border-top: 1px solid rgba(255,255,255,0.08); padding-bottom: env(safe-area-inset-bottom,0); }
  .rotasi-bottomnav-inner { display: flex; }
  .rotasi-bottomnav-item { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 8px 4px; text-decoration: none; color: #64748b; font-size: 10px; font-weight: 600; gap: 3px; transition: all 0.15s; }
  .rotasi-bottomnav-item .bnav-icon { font-size: 20px; line-height: 1; }
  .rotasi-bottomnav-item.active { color: #60a5fa; }
  .rotasi-overlay { display: none; position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.6); }
  .rotasi-overlay.open { display: block; }
  .rotasi-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: 260px; z-index: 70; background: linear-gradient(180deg,#0f172a 0%,#1e293b 100%); transform: translateX(-100%); transition: transform 0.25s cubic-bezier(.4,0,.2,1); display: flex; flex-direction: column; }
  .rotasi-drawer.open { transform: translateX(0); }
  .rotasi-drawer-header { padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
  .rotasi-drawer-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; }
  .rotasi-drawer-nav { padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .rotasi-drawer-footer { padding: 12px 12px 24px; border-top: 1px solid rgba(255,255,255,0.08); }
  .r-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.03); }
  .r-btn-primary { padding: 9px 18px; background: linear-gradient(135deg,#2563eb,#1d4ed8); color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 13px; white-space: nowrap; box-shadow: 0 4px 12px rgba(37,99,235,0.28); transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
  .r-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37,99,235,0.35); }
  .r-btn-primary:active { transform: translateY(0); }
  .r-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .r-btn-secondary { padding: 9px 14px; background: #fff; color: #334155; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
  .r-btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
  .r-btn-danger { padding: 6px 12px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.15s; }
  .r-btn-danger:hover { background: #fee2e2; }
  .r-btn-edit { padding: 6px 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.15s; }
  .r-btn-edit:hover { background: #dbeafe; }
  .r-input { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none; background: #fff; width: 100%; transition: border-color 0.15s,box-shadow 0.15s; box-sizing: border-box; color: #0f172a; font-family: inherit; }
  .r-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
  .r-select { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; outline: none; background: #fff; width: 100%; transition: border-color 0.15s; cursor: pointer; color: #0f172a; box-sizing: border-box; font-family: inherit; }
  .r-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
  .r-badge { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .r-badge-green { background: #dcfce7; color: #15803d; }
  .r-badge-gray { background: #f1f5f9; color: #64748b; }
  .r-badge-blue { background: #dbeafe; color: #1d4ed8; }
  .r-badge-amber { background: #fef3c7; color: #92400e; }
  .r-badge-red { background: #fee2e2; color: #dc2626; }
  .r-page-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
  .r-page-sub { color: #64748b; margin: 4px 0 0; font-size: 13px; }
  .r-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .r-modal { background: #fff; border-radius: 18px; padding: 28px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.2); }
  .r-modal-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 20px; }
  .r-field { margin-bottom: 14px; }
  .r-label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 5px; }
  .r-divider { height: 1px; background: #f1f5f9; margin: 20px 0; }
  .r-empty { text-align: center; padding: 60px 20px; }
  .r-empty-icon { font-size: 44px; margin-bottom: 12px; }
  .r-empty-title { font-weight: 700; font-size: 15px; color: #334155; margin: 0 0 6px; }
  .r-empty-sub { font-size: 13px; color: #94a3b8; margin: 0; }
  .r-table { width: 100%; border-collapse: collapse; }
  .r-th { padding: 10px 14px; text-align: left; font-weight: 700; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; background: #f8fafc; white-space: nowrap; cursor: pointer; user-select: none; }
  .r-td { padding: 11px 14px; font-size: 13px; color: #1e293b; border-top: 1px solid #f1f5f9; }
  .r-tr:hover .r-td { background: #f8fafc; }
  .r-table-wrap { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; overflow-x: auto; }
  .r-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
  .r-filter-bar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .r-therapist-grid { display: grid; gap: 12px; }
  .r-two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .r-inline-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  @media (max-width: 768px) {
    .rotasi-sidebar { display: none; }
    .rotasi-topbar { display: flex; }
    .rotasi-bottomnav { display: block; }
    .rotasi-main { margin-left: 0 !important; padding: 68px 16px 76px; }
    .r-modal { padding: 20px 16px; border-radius: 14px; max-width: 100%; }
    .r-page-title { font-size: 19px; }
    .r-overlay { align-items: flex-end; padding: 0; }
    .r-modal { width: 100%; max-height: 92vh; border-radius: 16px 16px 0 0; }
    .r-therapist-grid { grid-template-columns: 1fr !important; }
    .r-two-col-grid { grid-template-columns: 1fr !important; }
    .r-inline-form { flex-direction: column; align-items: stretch; }
    .r-inline-form input, .r-inline-form select, .r-inline-form button { width: 100% !important; }
  }
  @media (min-width: 769px) and (max-width: 1024px) {
    :root { --sidebar-w: 200px; }
    .rotasi-main { padding: 24px 24px 40px; }
  }
  @media (display-mode: standalone) {
    .rotasi-topbar { padding-top: env(safe-area-inset-top,0); height: calc(56px + env(safe-area-inset-top,0)); }
    .rotasi-main { padding-top: calc(68px + env(safe-area-inset-top,0)); }
  }
`;

const RotasiLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const currentNav = NAV.find((n) => location.pathname.startsWith(n.to));

  return (
    <>
      <style>{CSS}</style>
      <div className="rotasi-wrapper">

        {/* Sidebar desktop */}
        <aside className="rotasi-sidebar">
          <div className="rotasi-brand">
            <div className="rotasi-brand-icon">🔄</div>
            <div>
              <div className="rotasi-brand-text">Rotasi</div>
              <div className="rotasi-brand-sub">Jadwal Terapis</div>
            </div>
          </div>
          <nav className="rotasi-nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'rotasi-navlink' + (isActive ? ' active' : '')}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.full}
              </NavLink>
            ))}
          </nav>
          <div className="rotasi-sidebar-footer">
            <button onClick={handleLogout} className="rotasi-logout">
              <span>🚪</span> Keluar
            </button>
          </div>
        </aside>

        {/* Topbar mobile */}
        <div className="rotasi-topbar">
          <div>
            <div className="rotasi-topbar-brand">🔄 Rotasi</div>
            {currentNav && (
              <div className="rotasi-topbar-page">{currentNav.full}</div>
            )}
          </div>
          <button
            className="rotasi-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka menu"
          >
            ☰
          </button>
        </div>

        {/* Overlay drawer */}
        <div
          className={'rotasi-overlay' + (menuOpen ? ' open' : '')}
          onClick={() => setMenuOpen(false)}
        />

        {/* Drawer mobile */}
        <div className={'rotasi-drawer' + (menuOpen ? ' open' : '')}>
          <div className="rotasi-drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="rotasi-brand-icon" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 15 }}>
                🔄
              </div>
              <div>
                <div className="rotasi-brand-text">Rotasi</div>
                <div className="rotasi-brand-sub">Jadwal Terapis</div>
              </div>
            </div>
            <button className="rotasi-drawer-close" onClick={() => setMenuOpen(false)}>
              ✕
            </button>
          </div>
          <nav className="rotasi-drawer-nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'rotasi-navlink' + (isActive ? ' active' : '')}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.full}
              </NavLink>
            ))}
          </nav>
          <div className="rotasi-drawer-footer">
            <button onClick={handleLogout} className="rotasi-logout">
              <span>🚪</span> Keluar
            </button>
          </div>
        </div>

        {/* Main content */}
        <main className="rotasi-main">{children}</main>

        {/* Bottom nav mobile */}
        <nav className="rotasi-bottomnav">
          <div className="rotasi-bottomnav-inner">
            {NAV.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={'rotasi-bottomnav-item' + (isActive ? ' active' : '')}
                >
                  <span className="bnav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
};

export default RotasiLayout;