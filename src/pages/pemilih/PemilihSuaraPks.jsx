import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import PemilihSelect from './PemilihSelect';
import {
  Loader2, FileUp, Search, X, Trophy, Vote, MapPin, Users, BarChart3,
  PieChart as PieChartIcon, Save, CheckCircle2, LayoutGrid, UploadCloud, RefreshCw,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CONCURRENCY = 3;
const RENDER_SCALE = 1.8;
const PARTY_MATCH = /keadilan\s*sejahtera/i;

const RANK_COLORS = ['#dc2626', '#d97706', '#2563eb', '#7c3aed', '#059669'];
const PIE_COLORS = ['#dc2626', '#ef4444', '#f59e0b', '#2563eb', '#7c3aed', '#059669', '#0891b2', '#db2777', '#65a30d', '#9333ea', '#0d9488', '#94a3b8'];

const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const renderPageToBase64 = async (pdf, pageNumber, rotate) => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  let finalCanvas = canvas;
  if (rotate) {
    const rotated = document.createElement('canvas');
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const rctx = rotated.getContext('2d');
    rctx.translate(rotated.width / 2, rotated.height / 2);
    rctx.rotate(-Math.PI / 2);
    rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    finalCanvas = rotated;
  }
  const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.88);
  return dataUrl.split(',')[1];
};

const StatPill = ({ icon: Icon, label, value, color, bg }) => (
  <div className="p-card p-card-hover" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} strokeWidth={2.3} />
      </div>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#1a1d29', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  </div>
);

const CardHeader = ({ title, subtitle, icon: Icon, iconColor, iconBg }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
    {Icon && (
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Icon size={15} color={iconColor} />
      </div>
    )}
    <div>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29', letterSpacing: '-0.01em' }}>{title}</h3>
      {subtitle && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#9ca3af' }}>{subtitle}</p>}
    </div>
  </div>
);

const PemilihSuaraPks = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState('dashboard');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [filterKelurahan, setFilterKelurahan] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: suara }, { data: kel }] = await Promise.all([
      supabase.from('pemilih_suara_caleg').select('id, kelurahan_id, candidate_number, candidate_name, total_suara, sheet_info, updated_at').order('candidate_number'),
      supabase.from('pemilih_kelurahan').select('id, nama').order('nama'),
    ]);
    setRows(suara || []);
    setKelurahanList(kel || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const kelurahanMap = useMemo(() => {
    const map = {};
    kelurahanList.forEach((k) => { map[k.id] = k.nama; });
    return map;
  }, [kelurahanList]);

  const filteredRows = useMemo(
    () => (filterKelurahan ? rows.filter((r) => r.kelurahan_id === filterKelurahan) : rows),
    [rows, filterKelurahan]
  );

  const kelurahanTercakup = useMemo(() => new Set(rows.map((r) => r.kelurahan_id)), [rows]);

  const totalSuaraPartai = useMemo(
    () => filteredRows.reduce((sum, r) => sum + (r.total_suara || 0), 0),
    [filteredRows]
  );

  const totalSuaraTanpaCalon = useMemo(
    () => filteredRows.filter((r) => r.candidate_number === 0).reduce((sum, r) => sum + (r.total_suara || 0), 0),
    [filteredRows]
  );

  const perCaleg = useMemo(() => {
    const agg = {};
    filteredRows.forEach((r) => {
      const key = r.candidate_number;
      if (!agg[key]) {
        agg[key] = {
          candidate_number: r.candidate_number,
          candidate_name: r.candidate_name || 'Suara Partai (tanpa calon)',
          isPartyRow: r.candidate_number === 0,
          total: 0,
          perKelurahan: [],
        };
      }
      agg[key].total += r.total_suara || 0;
      agg[key].perKelurahan.push({ kelurahan: kelurahanMap[r.kelurahan_id] || '-', total: r.total_suara || 0 });
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [filteredRows, kelurahanMap]);

  const calegOnly = useMemo(() => perCaleg.filter((c) => !c.isPartyRow), [perCaleg]);

  const chartData = useMemo(
    () => calegOnly.map((c) => ({
      name: c.candidate_name.length > 22 ? c.candidate_name.slice(0, 20) + '…' : c.candidate_name,
      fullName: c.candidate_name,
      total: c.total,
    })),
    [calegOnly]
  );

  const pieData = useMemo(() => {
    const top = calegOnly.slice(0, 8).map((c) => ({ name: c.candidate_name, value: c.total }));
    const restTotal = calegOnly.slice(8).reduce((s, c) => s + c.total, 0);
    if (restTotal > 0) top.push({ name: 'Lainnya', value: restTotal });
    if (totalSuaraTanpaCalon > 0) top.push({ name: 'Suara Partai (tanpa calon)', value: totalSuaraTanpaCalon });
    return top;
  }, [calegOnly, totalSuaraTanpaCalon]);

  const perKelurahanTotal = useMemo(() => {
    const agg = {};
    rows.forEach((r) => {
      const nama = kelurahanMap[r.kelurahan_id] || 'Belum Diketahui';
      agg[nama] = (agg[nama] || 0) + (r.total_suara || 0);
    });
    return Object.entries(agg).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total);
  }, [rows, kelurahanMap]);

  return (
    <div>
      <div style={{
        borderRadius: 20, padding: '26px 30px', marginBottom: 24,
        background: 'linear-gradient(135deg, #17181f 0%, #142b1e 60%, #0d3b1f 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.25), transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Vote size={16} color="#86efac" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Perolehan Suara Pileg
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Partai Keadilan Sejahtera — DPRD Kota Balikpapan
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#d4d4d8' }}>
            Rekap suara caleg PKS per kelurahan, berdasarkan Formulir Model DAA1-DPRD yang diupload.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap', borderBottom: '1.5px solid var(--p-border)', paddingBottom: 12 }}>
        {[
          { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
          { key: 'upload', label: 'Upload PDF per Kelurahan', icon: UploadCloud },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 11, border: '1.5px solid ' + (active ? '#059669' : 'var(--p-border)'),
                background: active ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff',
                color: active ? '#fff' : '#4b5563',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.16s',
              }}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'dashboard' ? (
        loading ? (
          <div style={{ padding: 80, textAlign: 'center' }}><Loader2 className="animate-spin" size={30} color="#059669" /></div>
        ) : rows.length === 0 ? (
          <div className="p-card" style={{ padding: 50, textAlign: 'center' }}>
            <Vote size={32} color="#d4d4d8" style={{ marginBottom: 10 }} />
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Belum ada data suara PKS. Upload PDF Model DAA1-DPRD per kelurahan di tab "Upload PDF per Kelurahan".</p>
          </div>
        ) : (
          <PksDashboard
            kelurahanList={kelurahanList}
            filterKelurahan={filterKelurahan}
            setFilterKelurahan={setFilterKelurahan}
            kelurahanTercakup={kelurahanTercakup}
            totalSuaraPartai={totalSuaraPartai}
            totalSuaraTanpaCalon={totalSuaraTanpaCalon}
            perCaleg={perCaleg}
            calegOnly={calegOnly}
            chartData={chartData}
            pieData={pieData}
            perKelurahanTotal={perKelurahanTotal}
          />
        )
      ) : (
        <PksUpload kelurahanList={kelurahanList} onSaved={fetchAll} toast={toast} />
      )}
    </div>
  );
};

const PksDashboard = ({
  kelurahanList, filterKelurahan, setFilterKelurahan, kelurahanTercakup,
  totalSuaraPartai, totalSuaraTanpaCalon, perCaleg, calegOnly, chartData, pieData, perKelurahanTotal,
}) => {
  const maxCaleg = calegOnly[0]?.total || 1;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, flex: 1 }}>
          <StatPill icon={Vote} label="Total Suara PKS" value={totalSuaraPartai.toLocaleString('id-ID')} color="#059669" bg="#ecfdf5" />
          <StatPill icon={Trophy} label="Suara Partai (tanpa calon)" value={totalSuaraTanpaCalon.toLocaleString('id-ID')} color="#d97706" bg="#fffbeb" />
          <StatPill icon={Users} label="Caleg Terdaftar" value={calegOnly.length} color="#2563eb" bg="#eff6ff" />
          <StatPill icon={MapPin} label="Kelurahan Tercakup" value={`${kelurahanTercakup.size} / ${kelurahanList.length}`} color="#dc2626" bg="#fef2f2" />
        </div>
      </div>

      <div style={{ marginBottom: 20, maxWidth: 280 }}>
        <label className="p-label">Filter Kelurahan</label>
        <PemilihSelect
          value={filterKelurahan}
          onChange={setFilterKelurahan}
          options={kelurahanList.filter((k) => kelurahanTercakup.has(k.id)).map((k) => ({ value: k.id, label: k.nama }))}
          allLabel="Semua Kelurahan"
          title="Pilih Kelurahan"
        />
      </div>

      <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="p-card" style={{ padding: 24 }}>
          <CardHeader title="Perolehan Suara per Caleg" subtitle="Total suara sah tiap caleg PKS, diurutkan dari terbanyak" icon={BarChart3} iconColor="#059669" iconBg="#ecfdf5" />
          <div style={{ height: Math.max(300, chartData.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 34, left: 10, bottom: 5 }} barCategoryGap="28%">
                <defs>
                  <linearGradient id="gradCaleg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <filter id="barShadowPks" x="-20%" y="-40%" width="150%" height="180%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f3" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11.5, fill: '#4b5563', fontWeight: 500 }} axisLine={{ stroke: '#e8e9ec' }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#fafafa' }}
                  formatter={(value) => [Number(value).toLocaleString('id-ID'), 'Suara']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  contentStyle={{ borderRadius: 14, fontSize: 12, border: '1px solid #e8e9ec', boxShadow: '0 12px 32px rgba(16,24,40,0.12)', padding: '10px 14px' }}
                  labelStyle={{ fontWeight: 700, color: '#1a1d29', marginBottom: 4 }}
                />
                <Bar dataKey="total" fill="url(#gradCaleg)" radius={[0, 8, 8, 0]} filter="url(#barShadowPks)" maxBarSize={22}>
                  <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#1a1d29' }} formatter={(v) => v.toLocaleString('id-ID')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-card" style={{ padding: 24 }}>
          <CardHeader title="Distribusi Suara" subtitle="Proporsi suara caleg vs suara partai" icon={PieChartIcon} iconColor="#059669" iconBg="#ecfdf5" />
          <div style={{ height: 300, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="donutShadowPks" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.14" />
                  </filter>
                </defs>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={62} outerRadius={94} paddingAngle={3} cornerRadius={8} filter="url(#donutShadowPks)">
                  {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />)}
                </Pie>
                <Tooltip formatter={(value) => Number(value).toLocaleString('id-ID')} contentStyle={{ borderRadius: 14, fontSize: 12, border: '1px solid #e8e9ec', boxShadow: '0 12px 32px rgba(16,24,40,0.12)', padding: '10px 14px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {(totalSuaraPartai).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 3 }}>Total Suara</div>
            </div>
          </div>
          <div className="p-scrollbar" style={{ marginTop: 10, maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pieData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: '#4b5563', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span style={{ color: '#1a1d29', fontWeight: 700 }}>{d.value.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-card" style={{ padding: 24, marginBottom: 24 }}>
        <CardHeader title="Peringkat Caleg" subtitle="Daftar lengkap seluruh caleg PKS beserta rincian suara per kelurahan" icon={Trophy} iconColor="#d97706" iconBg="#fffbeb" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {perCaleg.map((c, i) => {
            const rank = c.isPartyRow ? null : calegOnly.findIndex((x) => x.candidate_number === c.candidate_number);
            const rankColor = rank !== null && rank >= 0 ? (RANK_COLORS[rank] || '#94a3b8') : '#94a3b8';
            const pct = c.isPartyRow ? 0 : Math.max(4, (c.total / maxCaleg) * 100);
            const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null;
            return (
              <div key={c.candidate_number} style={{
                padding: '14px 16px', borderRadius: 14, border: '1px solid #eceef1',
                background: c.isPartyRow ? '#fffbeb' : 'linear-gradient(150deg, #ffffff 0%, #fafbfc 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: c.isPartyRow ? '#fde68a55' : rankColor + '1a', color: c.isPartyRow ? '#b45309' : rankColor,
                      fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {medal || (c.isPartyRow ? '★' : (rank >= 0 ? rank + 1 : c.candidate_number))}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1d29', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.isPartyRow ? 'Suara Partai (tanpa calon)' : `${c.candidate_number}. ${c.candidate_name}`}
                      </div>
                      {!c.isPartyRow && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Nomor urut {c.candidate_number}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                    {c.total.toLocaleString('id-ID')} <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>suara</span>
                  </div>
                </div>
                {!c.isPartyRow && (
                  <div style={{ marginTop: 10, height: 6, borderRadius: 4, background: '#f1f2f4', overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}cc)` }} />
                  </div>
                )}
                {c.perKelurahan.length > 1 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {c.perKelurahan.map((pk) => (
                      <span key={pk.kelurahan} className="p-badge" style={{ background: '#f4f5f7', color: '#4b5563', fontWeight: 600 }}>
                        {pk.kelurahan}: {pk.total.toLocaleString('id-ID')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-card" style={{ padding: 24 }}>
        <CardHeader title="Total Suara PKS per Kelurahan" subtitle="Jumlah seluruh suara (partai + caleg) yang sudah terekam per kelurahan" icon={MapPin} iconColor="#dc2626" iconBg="#fef2f2" />
        {perKelurahanTotal.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Belum ada data.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {perKelurahanTotal.map((w, i) => {
              const maxTotal = perKelurahanTotal[0].total || 1;
              const pct = Math.max(6, (w.total / maxTotal) * 100);
              const rankColor = RANK_COLORS[i] || '#94a3b8';
              return (
                <div key={w.nama} className="p-card-hover" style={{
                  position: 'relative', borderRadius: 16, padding: '18px 18px 16px',
                  background: 'linear-gradient(150deg, #ffffff 0%, #fafbfc 100%)', border: '1px solid #eceef1', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: -18, right: -18, width: 70, height: 70, borderRadius: '50%', background: `radial-gradient(circle, ${rankColor}22, transparent 70%)` }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, background: rankColor + '1a', color: rankColor, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1d29' }}>{w.nama}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 12, position: 'relative', zIndex: 1 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em' }}>{w.total.toLocaleString('id-ID')}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>suara</span>
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
    </div>
  );
};

const PksUpload = ({ kelurahanList, onSaved, toast }) => {
  const fileInputRef = useRef(null);
  const cancelRef = useRef(false);

  const [kelurahanId, setKelurahanId] = useState('');
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(1);
  const [rotate, setRotate] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pageResults, setPageResults] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPageResults([]);
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      setNumPages(pdf.numPages);
      setPageFrom(1);
      setPageTo(pdf.numPages);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membaca PDF', description: err.message });
    }
  };

  const handleCancel = () => { cancelRef.current = true; };

  const handleProcess = async () => {
    if (!file) return;
    if (!kelurahanId) {
      toast({ variant: 'destructive', title: 'Pilih kelurahan dulu', description: 'Tentukan PDF ini data untuk kelurahan mana.' });
      return;
    }
    const from = Math.max(1, Math.min(pageFrom, numPages));
    const to = Math.max(from, Math.min(pageTo, numPages));
    const pageNumbers = [];
    for (let i = from; i <= to; i++) pageNumbers.push(i);

    setProcessing(true);
    cancelRef.current = false;
    setPageResults([]);
    setProgress({ done: 0, total: pageNumbers.length });

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const results = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < pageNumbers.length) {
        if (cancelRef.current) return;
        const idx = cursor++;
        const pageNumber = pageNumbers[idx];
        let lastError = null;
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            const image_base64 = await renderPageToBase64(pdf, pageNumber, rotate);
            if (cancelRef.current) return;
            const { data, error } = await supabase.functions.invoke('pemilih-ocr-suara-pdf', {
              body: { image_base64, media_type: 'image/jpeg' },
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);
            results.push({ pageNumber, ...(data?.data || { is_vote_table: false, rows: [], column_headers: [] }) });
            ok = true;
          } catch (err) {
            lastError = err.message;
          }
        }
        if (!ok) results.push({ pageNumber, is_vote_table: false, rows: [], column_headers: [], error: lastError });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    results.sort((a, b) => a.pageNumber - b.pageNumber);
    setPageResults(results);
    setProcessing(false);
    if (cancelRef.current) {
      toast({ title: 'Ekstraksi dibatalkan' });
    } else {
      const tableCount = results.filter((r) => r.is_vote_table).length;
      toast({ title: 'Ekstraksi selesai', description: `${tableCount} dari ${results.length} halaman memuat tabel suara.` });
    }
  };

  // Kumpulkan baris PKS dari semua halaman, lalu ambil nilai "total" (kolom
  // JUMLAH PINDAHAN/AKHIR) dari halaman bernomor terbesar sebagai total akhir —
  // kolom itu sendiri sudah kumulatif berjalan dari halaman-halaman sebelumnya.
  const pksResult = useMemo(() => {
    const groups = new Map();
    pageResults.forEach((page) => {
      if (!page.is_vote_table) return;
      (page.rows || []).forEach((row) => {
        if (!PARTY_MATCH.test(row.party_name || '')) return;
        const isPartyRow = !!row.is_party_row && !row.candidate_name;
        const key = isPartyRow ? 'party' : `cand::${normalize(row.candidate_name)}`;
        const existing = groups.get(key);
        if (!existing || page.pageNumber > existing.pageNumber) {
          groups.set(key, {
            key,
            isPartyRow,
            candidateNumber: row.candidate_number ? Number(row.candidate_number) : (isPartyRow ? 0 : null),
            candidateName: isPartyRow ? null : row.candidate_name,
            total: row.total ?? null,
            pageNumber: page.pageNumber,
          });
        }
      });
    });
    const items = Array.from(groups.values()).sort((a, b) => (a.candidateNumber ?? 99) - (b.candidateNumber ?? 99));
    const sheetInfo = pageResults.find((p) => p.is_vote_table)?.sheet_info || null;
    return { items, sheetInfo };
  }, [pageResults]);

  const handleSave = async () => {
    if (!kelurahanId) return;
    if (pksResult.items.length === 0) {
      toast({ variant: 'destructive', title: 'Tidak ada data PKS untuk disimpan' });
      return;
    }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const payload = pksResult.items
      .filter((it) => it.total !== null && it.total !== undefined)
      .map((it) => ({
        kelurahan_id: kelurahanId,
        party_name: 'Partai Keadilan Sejahtera',
        candidate_number: it.candidateNumber ?? 0,
        candidate_name: it.candidateName,
        total_suara: it.total,
        source_file_name: file?.name || null,
        sheet_info: pksResult.sheetInfo,
        updated_by: authData?.user?.id || null,
        updated_at: new Date().toISOString(),
      }));
    const { error } = await supabase.from('pemilih_suara_caleg').upsert(payload, { onConflict: 'kelurahan_id,candidate_number' });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    toast({ title: 'Data tersimpan', description: `${payload.length} baris suara PKS disimpan untuk kelurahan terpilih.` });
    onSaved();
  };

  return (
    <div>
      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <label className="p-label">Data ini untuk kelurahan mana?</label>
        <PemilihSelect
          value={kelurahanId}
          onChange={setKelurahanId}
          options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
          placeholder="Pilih Kelurahan"
          title="Pilih Kelurahan"
          style={{ maxWidth: 320 }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
          <button className="p-btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={processing}>
            <FileUp size={15} /> {file ? 'Ganti File PDF' : 'Pilih File PDF (Model DAA1-DPRD)'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />
          {file && (
            <span style={{ fontSize: 12.5, color: '#6b7280' }}>{file.name} — {numPages} halaman</span>
          )}
        </div>

        {file && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16 }}>
            <div>
              <label className="p-label">Halaman awal</label>
              <input type="number" className="p-input" style={{ width: 100 }} min={1} max={numPages} value={pageFrom} onChange={(e) => setPageFrom(Number(e.target.value) || 1)} disabled={processing} />
            </div>
            <div>
              <label className="p-label">Halaman akhir</label>
              <input type="number" className="p-input" style={{ width: 100 }} min={1} max={numPages} value={pageTo} onChange={(e) => setPageTo(Number(e.target.value) || numPages)} disabled={processing} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#4b5563', marginBottom: 10 }}>
              <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} disabled={processing} />
              Putar halaman 90°
            </label>
            {!processing ? (
              <button className="p-btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={handleProcess}>
                <Search size={15} /> Mulai Ekstrak
              </button>
            ) : (
              <button className="p-btn-ghost" onClick={handleCancel} style={{ color: '#dc2626' }}>
                <X size={15} /> Batalkan
              </button>
            )}
          </div>
        )}

        {processing && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#6b7280', marginBottom: 6 }}>
              <Loader2 className="animate-spin" size={14} /> Memproses halaman {progress.done} dari {progress.total}...
            </div>
            <div style={{ height: 6, borderRadius: 4, background: '#f1f2f4', overflow: 'hidden' }}>
              <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #34d399, #059669)', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}
      </div>

      {!processing && pageResults.length > 0 && (
        <div className="p-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Hasil Ekstraksi — Partai Keadilan Sejahtera</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                {pageResults.filter((r) => r.is_vote_table).length} dari {pageResults.length} halaman terbaca sebagai tabel suara.
                {pksResult.sheetInfo?.desa_kelurahan && ` Terdeteksi: ${pksResult.sheetInfo.desa_kelurahan}.`}
              </p>
            </div>
            <button className="p-btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={handleSave} disabled={saving || pksResult.items.length === 0}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan ke Database
            </button>
          </div>

          {pageResults.some((r) => r.error) && (
            <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
              {[...new Set(pageResults.filter((r) => r.error).map((r) => r.error))].map((msg, i) => (
                <p key={i} style={{ margin: i ? '6px 0 0' : 0, fontSize: 11.5, color: '#991b1b' }}>
                  Halaman {pageResults.filter((r) => r.error === msg).map((r) => r.pageNumber).join(', ')}: {msg}
                </p>
              ))}
            </div>
          )}

          {pksResult.items.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Tidak ditemukan baris Partai Keadilan Sejahtera pada halaman yang diproses. Pastikan halaman yang diupload memuat tabel "DATA PEROLEHAN SUARA PARTAI POLITIK DAN CALON" untuk partai tersebut.
            </p>
          ) : (
            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nama Calon</th>
                    <th style={{ textAlign: 'right' }}>Total Suara</th>
                    <th>Sumber</th>
                  </tr>
                </thead>
                <tbody>
                  {pksResult.items.map((it) => (
                    <tr key={it.key}>
                      <td>{it.isPartyRow ? '—' : it.candidateNumber}</td>
                      <td style={{ fontWeight: 700, color: '#1a1d29' }}>{it.isPartyRow ? 'Suara Partai (tanpa calon)' : it.candidateName}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        {it.total === null || it.total === undefined ? '?' : it.total.toLocaleString('id-ID')}
                      </td>
                      <td style={{ color: '#9ca3af', fontSize: 11.5 }}>Halaman {it.pageNumber}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ fontWeight: 800 }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>
                      {pksResult.items.reduce((s, it) => s + (it.total || 0), 0).toLocaleString('id-ID')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #bbf7d0' }}>
            <CheckCircle2 size={16} color="#16a34a" />
            <span style={{ fontSize: 12, color: '#166534' }}>
              Klik "Simpan ke Database" untuk menyimpan/memperbarui total suara kelurahan ini. Mengunggah ulang PDF yang sama akan menimpa data sebelumnya.
            </span>
          </div>
        </div>
      )}

      {!processing && pageResults.length === 0 && (
        <div className="p-card" style={{ padding: 40, textAlign: 'center' }}>
          <RefreshCw size={26} color="#d4d4d8" style={{ marginBottom: 10 }} />
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
            Pilih kelurahan, upload PDF Model DAA1-DPRD kelurahan tersebut, lalu klik "Mulai Ekstrak".
          </p>
        </div>
      )}
    </div>
  );
};

export default PemilihSuaraPks;
