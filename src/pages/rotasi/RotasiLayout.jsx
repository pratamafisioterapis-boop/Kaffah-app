import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

const navItems = [
  { to: '/rotasi/jadwal', label: 'Jadwal Hari Ini' },
  { to: '/rotasi/riwayat', label: 'Riwayat' },
  { to: '/rotasi/pasien', label: 'Pasien' },
  { to: '/rotasi/terapis', label: 'Terapis' },
];

const RotasiLayout = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>Rotasi Jadwal Terapis</div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} style={styles.logout}>Keluar</button>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
};

const styles = {
  wrapper: { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' },
  sidebar: { width: 220, background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', padding: '24px 16px' },
  brand: { fontWeight: 800, fontSize: 15, marginBottom: 28, paddingLeft: 8 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navLink: { padding: '10px 12px', borderRadius: 8, color: '#cbd5e1', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  navLinkActive: { background: '#2563eb', color: '#fff' },
  logout: { marginTop: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  main: { flex: 1, padding: '32px 40px', maxWidth: 1100 },
};

export default RotasiLayout;