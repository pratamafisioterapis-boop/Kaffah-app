import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, FileSpreadsheet, Calculator, Menu, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const NAV = [
  { to: '/konversi-dokter/pdf', label: 'Konversi PDF', description: 'Upload & rekap insentif', icon: FileSpreadsheet },
  { to: '/konversi-dokter/insentif-bulanan', label: 'Insentif Bulanan', description: 'Kalkulator rekap bulanan', icon: Calculator },
];

const Brand = ({ compact }) => (
  <div className="flex items-center gap-2.5">
    <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/20 ring-1 ring-white/10">
      <Sparkles className="w-4 h-4 text-white" />
    </div>
    {!compact && (
      <div className="leading-tight">
        <p className="font-extrabold text-[13px] text-white tracking-tight">Konversi Dokter</p>
        <p className="text-[10px] text-slate-400 font-medium">by Clinara</p>
      </div>
    )}
  </div>
);

const UserChip = ({ label, onLogout }) => (
  <div className="p-3 border-t border-white/5">
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.04] mb-1.5">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
        {(label || '?').charAt(0).toUpperCase()}
      </div>
      <p className="text-xs font-semibold text-slate-200 truncate">{label}</p>
    </div>
    <button
      type="button"
      onClick={onLogout}
      className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors"
    >
      <LogOut className="w-3.5 h-3.5" /> Keluar
    </button>
  </div>
);

const KonversiDokterLayout = ({ children }) => {
  const navigate = useNavigate();
  const { signOut, userDetails, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountLabel = userDetails?.full_name || user?.email || '';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const SidebarNav = ({ onNavigate }) => (
    <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
      {NAV.map(({ to, label, description, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/30'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive ? 'bg-white/15' : 'bg-white/5 group-hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="leading-tight truncate">{label}</p>
                <p className={`text-[10px] font-normal truncate ${isActive ? 'text-white/70' : 'text-slate-500'}`}>{description}</p>
              </div>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 sticky top-0 h-screen shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative h-16 flex items-center px-4 border-b border-white/5">
          <Brand />
        </div>
        <div className="relative flex-1 flex flex-col min-h-0">
          <SidebarNav />
          <UserChip label={accountLabel} onLogout={handleLogout} />
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 border-b border-white/5 h-14 flex items-center justify-between px-4 shadow-lg">
        <Brand compact />
        <button onClick={() => setMenuOpen(true)} aria-label="Buka menu" className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors">
          <Menu className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
              <Brand />
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-slate-300" />
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <SidebarNav onNavigate={() => setMenuOpen(false)} />
              <UserChip label={accountLabel} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 md:pt-6 pt-20 pb-10">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default KonversiDokterLayout;
