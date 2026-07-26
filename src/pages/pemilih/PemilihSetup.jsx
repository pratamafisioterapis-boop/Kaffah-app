import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Tag, ListChecks, UserPlus } from 'lucide-react';
import PemilihWilayahPanel from './PemilihWilayah';
import PemilihKategoriProgramPanel from './PemilihKategoriProgram';
import PemilihSetupTps from './PemilihSetupTps';
import PemilihRelawanAkun from './PemilihRelawanAkun';

const TABS = [
  { key: 'wilayah', label: 'Wilayah', icon: MapPin },
  { key: 'kategori', label: 'Kategori Program', icon: Tag },
  { key: 'tps', label: 'Jumlah TPS', icon: ListChecks },
  { key: 'relawan', label: 'Akun Relawan', icon: UserPlus },
];

const PemilihSetup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'wilayah';

  const setTab = (key) => setSearchParams({ tab: key }, { replace: true });

  return (
    <div>
      <h1 className="p-page-title">Setup</h1>
      <p className="p-page-subtitle">
        Semua pengaturan modul Data Pemilih ada di sini: wilayah, kategori program, dan jumlah TPS.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1.5px solid var(--p-border)', paddingBottom: 12 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 11, border: '1.5px solid ' + (active ? '#dc2626' : 'var(--p-border)'),
                background: active ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#fff',
                color: active ? '#fff' : '#4b5563',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.16s',
              }}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'wilayah' && <PemilihWilayahPanel />}
      {activeTab === 'kategori' && <PemilihKategoriProgramPanel />}
      {activeTab === 'tps' && <PemilihSetupTps />}
      {activeTab === 'relawan' && <PemilihRelawanAkun />}
    </div>
  );
};

export default PemilihSetup;
