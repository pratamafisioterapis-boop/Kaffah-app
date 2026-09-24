import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, FileSpreadsheet, Calculator, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const NAV = [
  { to: '/konversi-dokter/pdf', label: 'Konversi PDF', icon: FileSpreadsheet },
  { to: '/konversi-dokter/insentif-bulanan', label: 'Insentif Bulanan', icon: Calculator },
];

const KonversiDokterLayout = ({ children }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const SidebarNav = ({ onNavigate }) => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`
          }
        >
          <Icon className="w-4 h-4 shrink-0" /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm text-slate-800 leading-tight">Konversi Dokter</span>
        </div>
        <SidebarNav />
        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4">
        <span className="font-bold text-sm text-slate-800">Konversi Dokter</span>
        <button onClick={() => setMenuOpen(true)} aria-label="Buka menu" className="p-1.5 rounded-lg hover:bg-slate-100">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="relative w-64 bg-white h-full flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-800">Konversi Dokter</span>
              <button onClick={() => setMenuOpen(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
            <div className="p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 md:pt-6 pt-20">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default KonversiDokterLayout;
