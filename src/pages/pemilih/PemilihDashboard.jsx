import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Loader2, Users, ThumbsUp, ThumbsDown, HelpCircle, TrendingUp, MapPin, Sparkles, BarChart3, PieChart as PieChartIcon } from 'lucide-react';

const KATEGORI_LABEL = {
  pendukung: { label: 'Pendukung', color: '#16a34a' },
  simpatisan: { label: 'Simpatisan', color: '#2563eb' },
  netral: { label: 'Netral', color: '#6b7280' },
  tidak_mendukung: { label: 'Tidak Mendukung', color: '#dc2626' },
  belum_diketahui: { label: 'Belum Diketahui', color: '#d97706' },
};

const StatCard = ({ icon: Icon, label, value, color, bg, accentBar }) => (
  <div className="p-card p-card-hover" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentBar }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 46, height: 46, borderRadius: 13, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={21} color={color} strokeWidth={2.3} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1d29', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value.toLocaleString('id-ID')}
        </div>
        <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  </div>
);

const CardHeader = ({ title, subtitle, icon: Icon, iconColor, iconBg }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
    {Icon && (
      <div style={{
        width: 30, height: 30, borderRadius: 9, background: iconBg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
      }}>
        <Icon size={15} color={iconColor} />
      </div>
    )}
    <div>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29', letterSpacing: '-0.01em' }}>{title}</h3>
      {subtitle && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#9ca3af' }}>{subtitle}</p>}
    </div>
  </div>
);

const PemilihDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [rawRows, setRawRows] = useState([]);
  const [kelurahanMap, setKelurahanMap] = useState({});
  const [timSuksesTotalTarget, setTimSuksesTotalTarget] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      let allRows = [];
      let from = 0;
      while (true) {
        const { data: batch, error } = await supabase
          .from('pemilih_data')
          .select('id, kelurahan_id, kategori_dukungan, jenis_kelamin')
          .range(from, from + 999);
        if (error || !batch || batch.length === 0) break;
        allRows = [...allRows, ...batch];
        if (batch.length < 1000) break;
        from += 1000;
      }
      setRawRows(allRows);

      const { data: kel } = await supabase.from('pemilih_kelurahan').select('id, nama');
      const map = {};
      (kel || []).forEach((k) => { map[k.id] = k.nama; });
      setKelurahanMap(map);

      const { data: tim } = await supabase.from('pemilih_tim_sukses').select('target_suara');
      setTimSuksesTotalTarget((tim || []).reduce((sum, t) => sum + (t.target_suara || 0), 0));

      setLoading(false);
    };
    fetchAll();
  }, []);

  const stats = useMemo(() => {
    const s = { total: rawRows.length, pendukung: 0, simpatisan: 0, netral: 0, tidak_mendukung: 0, belum_diketahui: 0, L: 0, P: 0 };
    rawRows.forEach((r) => {
      s[r.kategori_dukungan || 'belum_diketahui'] = (s[r.kategori_dukungan || 'belum_diketahui'] || 0) + 1;
      if (r.jenis_kelamin === 'L') s.L += 1;
      if (r.jenis_kelamin === 'P') s.P += 1;
    });
    return s;
  }, [rawRows]);

  const perKelurahan = useMemo(() => {
    const agg = {};
    rawRows.forEach((r) => {
      const nama = kelurahanMap[r.kelurahan_id] || 'Belum Diketahui';
      if (!agg[nama]) agg[nama] = { nama, total: 0, pendukung: 0, simpatisan: 0, tidak_mendukung: 0, belum_diketahui: 0 };
      agg[nama].total += 1;
      if (r.kategori_dukungan === 'pendukung') agg[nama].pendukung += 1;
      else if (r.kategori_dukungan === 'simpatisan') agg[nama].simpatisan += 1;
      else if (r.kategori_dukungan === 'tidak_mendukung') agg[nama].tidak_mendukung += 1;
      else agg[nama].belum_diketahui += 1;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [rawRows, kelurahanMap]);

  const kelurahanPrioritas = useMemo(() => {
    return perKelurahan
      .filter((w) => w.total >= 3)
      .map((w) => ({ ...w, rasioPendukung: w.total ? (w.pendukung / w.total) * 100 : 0 }))
      .sort((a, b) => a.rasioPendukung - b.rasioPendukung);
  }, [perKelurahan]);

  const pieData = Object.entries(KATEGORI_LABEL).map(([key, v]) => ({ name: v.label, value: stats[key] || 0, color: v.color }));

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={30} color="#dc2626" />
      </div>
    );
  }

  return (
    <div>
      {/* Header banner */}
      <div style={{
        borderRadius: 20, padding: '26px 30px', marginBottom: 26,
        background: 'linear-gradient(135deg, #17181f 0%, #2a1416 60%, #3b0d0d 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.25), transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={16} color="#fca5a5" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Dashboard & Strategi
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Ringkasan Data Pemilih
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#d4d4d8' }}>
            Kecamatan Balikpapan Utara — dapil DPRD Kota Balikpapan
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 26 }}>
        <StatCard icon={Users} label="Total Data Pemilih" value={stats.total} color="#2563eb" bg="#eff6ff" accentBar="linear-gradient(90deg,#3b82f6,#2563eb)" />
        <StatCard icon={ThumbsUp} label="Pendukung" value={stats.pendukung} color="#16a34a" bg="#f0fdf4" accentBar="linear-gradient(90deg,#22c55e,#16a34a)" />
        <StatCard icon={HelpCircle} label="Simpatisan" value={stats.simpatisan} color="#2563eb" bg="#eff6ff" accentBar="linear-gradient(90deg,#60a5fa,#2563eb)" />
        <StatCard icon={ThumbsDown} label="Tidak Mendukung" value={stats.tidak_mendukung} color="#dc2626" bg="#fef2f2" accentBar="linear-gradient(90deg,#f87171,#dc2626)" />
        <StatCard icon={TrendingUp} label="Target Suara Tim Sukses" value={timSuksesTotalTarget} color="#d97706" bg="#fffbeb" accentBar="linear-gradient(90deg,#fbbf24,#d97706)" />
      </div>

      <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 26 }}>
        <div className="p-card" style={{ padding: 24 }}>
          <CardHeader
            title="Sebaran Data Pemilih per Kelurahan"
            subtitle="Distribusi jumlah data tercatat di tiap kelurahan"
            icon={BarChart3} iconColor="#2563eb" iconBg="#eff6ff"
          />
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perKelurahan} margin={{ top: 5, right: 10, left: -10, bottom: 50 }} barCategoryGap="34%" maxBarSize={56}>
                <defs>
                  <linearGradient id="gradPendukung" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#15803d" />
                  </linearGradient>
                  <linearGradient id="gradSimpatisan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                  <linearGradient id="gradTidakMendukung" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#b91c1c" />
                  </linearGradient>
                  <linearGradient id="gradBelumDiketahui" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                  <filter id="barShadow" x="-40%" y="-20%" width="180%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.12" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f3" />
                <XAxis dataKey="nama" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10.5, fill: '#6b7280', fontWeight: 500 }} height={70} axisLine={{ stroke: '#e8e9ec' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  cursor={{ fill: '#fafafa' }}
                  contentStyle={{ borderRadius: 14, fontSize: 12, border: '1px solid #e8e9ec', boxShadow: '0 12px 32px rgba(16,24,40,0.12)', padding: '10px 14px' }}
                  labelStyle={{ fontWeight: 700, color: '#1a1d29', marginBottom: 4 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" iconSize={8} />
                <Bar dataKey="pendukung" stackId="a" fill="url(#gradPendukung)" name="Pendukung" filter="url(#barShadow)" />
                <Bar dataKey="simpatisan" stackId="a" fill="url(#gradSimpatisan)" name="Simpatisan" filter="url(#barShadow)" />
                <Bar dataKey="tidak_mendukung" stackId="a" fill="url(#gradTidakMendukung)" name="Tidak Mendukung" filter="url(#barShadow)" />
                <Bar dataKey="belum_diketahui" stackId="a" fill="url(#gradBelumDiketahui)" name="Belum Diketahui" radius={[8, 8, 0, 0]} filter="url(#barShadow)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-card" style={{ padding: 24 }}>
          <CardHeader
            title="Komposisi Dukungan"
            subtitle="Proporsi kategori seluruh data"
            icon={PieChartIcon} iconColor="#dc2626" iconBg="#fef2f2"
          />
          <div style={{ height: 300, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="donutShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.14" />
                  </filter>
                </defs>
                <Pie
                  data={pieData} dataKey="value" nameKey="name" cx="50%" cy="46%"
                  innerRadius={62} outerRadius={94} paddingAngle={3} cornerRadius={8}
                  filter="url(#donutShadow)"
                >
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 14, fontSize: 12, border: '1px solid #e8e9ec', boxShadow: '0 12px 32px rgba(16,24,40,0.12)', padding: '10px 14px' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {stats.total.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10.5, color: '#9ca3af', fontWeight: 600, marginTop: 3 }}>Total Data</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-card" style={{ padding: 24, marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={15} color="#2563eb" />
          </div>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29' }}>Total Pemilih per Kelurahan</h3>
        </div>
        <p style={{ margin: '4px 0 18px 38px', fontSize: 11.5, color: '#9ca3af' }}>
          Jumlah total data pemilih tercatat di tiap kelurahan, diurutkan dari terbanyak.
        </p>
        {perKelurahan.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Belum ada data kelurahan.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {perKelurahan.map((w, i) => {
              const maxTotal = perKelurahan[0].total || 1;
              const pct = Math.max(6, (w.total / maxTotal) * 100);
              const rankColors = ['#dc2626', '#d97706', '#2563eb'];
              const rankColor = rankColors[i] || '#94a3b8';
              return (
                <div key={w.nama} className="p-card-hover" style={{
                  position: 'relative', borderRadius: 16, padding: '18px 18px 16px',
                  background: 'linear-gradient(150deg, #ffffff 0%, #fafbfc 100%)',
                  border: '1px solid #eceef1', overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
                }}>
                  <div style={{ position: 'absolute', top: -18, right: -18, width: 70, height: 70, borderRadius: '50%', background: `radial-gradient(circle, ${rankColor}22, transparent 70%)` }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 7, background: rankColor + '1a', color: rankColor,
                      fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1d29' }}>{w.nama}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 12, position: 'relative', zIndex: 1 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em' }}>{w.total}</span>
                    <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500 }}>pemilih</span>
                  </div>
                  <div style={{ marginTop: 12, height: 6, borderRadius: 4, background: '#f1f2f4', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}cc)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={15} color="#dc2626" />
          </div>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29' }}>Peringkat Kelurahan Perlu Digarap</h3>
        </div>
        <p style={{ margin: '4px 0 18px 38px', fontSize: 11.5, color: '#9ca3af' }}>
          Diurutkan dari rasio dukungan paling rendah (minimal 3 data tercatat) — prioritaskan kunjungan/kegiatan di kelurahan teratas.
        </p>
        {kelurahanPrioritas.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Belum cukup data untuk analisis per kelurahan.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="p-table">
              <thead>
                <tr>
                  <th>Kelurahan</th>
                  <th style={{ textAlign: 'right' }}>Total Data</th>
                  <th style={{ textAlign: 'right' }}>Pendukung</th>
                  <th style={{ textAlign: 'right' }}>Simpatisan</th>
                  <th style={{ textAlign: 'right' }}>Tidak Mendukung</th>
                  <th style={{ textAlign: 'right' }}>Rasio Dukungan</th>
                </tr>
              </thead>
              <tbody>
                {kelurahanPrioritas.map((w) => (
                  <tr key={w.nama}>
                    <td style={{ fontWeight: 700, color: '#1a1d29' }}>{w.nama}</td>
                    <td style={{ textAlign: 'right', color: '#4b5563' }}>{w.total}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{w.pendukung}</td>
                    <td style={{ textAlign: 'right', color: '#2563eb' }}>{w.simpatisan}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>{w.tidak_mendukung}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="p-badge" style={{
                        color: w.rasioPendukung < 20 ? '#dc2626' : w.rasioPendukung < 40 ? '#d97706' : '#16a34a',
                        background: w.rasioPendukung < 20 ? '#fef2f2' : w.rasioPendukung < 40 ? '#fffbeb' : '#f0fdf4',
                      }}>
                        {w.rasioPendukung.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PemilihDashboard;