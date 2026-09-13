import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllRows } from '@/lib/supabasePaginate';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Users, MapPin, ListChecks, Settings, Plus } from 'lucide-react';

const StatPill = ({ icon: Icon, label, value }) => (
  <div className="p-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 160 }}>
    <div style={{
      width: 40, height: 40, borderRadius: 11, background: '#fef2f2',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={18} color="#dc2626" />
    </div>
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1d29', lineHeight: 1 }}>{value.toLocaleString('id-ID')}</div>
      <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

const PemilihDataDpt = () => {
  const { toast } = useToast();
  const [kelurahanList, setKelurahanList] = useState([]);
  const [tpsRows, setTpsRows] = useState([]);
  const [periodeRows, setPeriodeRows] = useState([]);
  const [editMap, setEditMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKelurahan, setSavingKelurahan] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [newYear, setNewYear] = useState('');
  const [addingYear, setAddingYear] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    // pemilih_tps & pemilih_dpt_periode tanpa paginasi eksplisit kena batas
    // 1000 baris PostgREST — dpt_periode saja sudah ~950 baris di produksi
    // untuk satu kecamatan, jadi ini bukan risiko teoretis.
    const [{ data: kel }, { data: tps }, { data: periode }] = await Promise.all([
      supabase.from('pemilih_kelurahan').select('id, nama').order('nama'),
      fetchAllRows(() => supabase.from('pemilih_tps').select('id, kelurahan_id, nomor_tps').order('nomor_tps')),
      fetchAllRows(() => supabase.from('pemilih_dpt_periode').select('tps_id, tahun, jumlah')),
    ]);
    setKelurahanList(kel || []);
    setTpsRows(tps || []);
    setPeriodeRows(periode || []);
    setLoading(false);
    return periode || [];
  };

  useEffect(() => {
    fetchAll().then((periode) => {
      const years = [...new Set(periode.map((p) => p.tahun))].sort((a, b) => b - a);
      setActiveYear((prev) => prev ?? years[0] ?? new Date().getFullYear());
    });
  }, []);

  const years = useMemo(() => {
    const set = new Set(periodeRows.map((p) => p.tahun));
    if (activeYear) set.add(activeYear);
    return [...set].sort((a, b) => b - a);
  }, [periodeRows, activeYear]);

  const periodeByKey = useMemo(() => {
    const map = {};
    periodeRows.forEach((p) => { map[`${p.tps_id}-${p.tahun}`] = p.jumlah; });
    return map;
  }, [periodeRows]);

  useEffect(() => {
    if (!activeYear || tpsRows.length === 0) return;
    const initial = {};
    tpsRows.forEach((t) => { initial[t.id] = String(periodeByKey[`${t.id}-${activeYear}`] ?? 0); });
    setEditMap(initial);
  }, [activeYear, tpsRows, periodeByKey]);

  const grouped = useMemo(() => {
    const map = {};
    kelurahanList.forEach((k) => { map[k.id] = { kelurahan: k, tps: [] }; });
    tpsRows.forEach((t) => {
      if (map[t.kelurahan_id]) map[t.kelurahan_id].tps.push(t);
    });
    return Object.values(map);
  }, [kelurahanList, tpsRows]);

  const subtotal = (tpsList) => tpsList.reduce((sum, t) => sum + (parseInt(editMap[t.id], 10) || 0), 0);
  const grandTotal = tpsRows.reduce((sum, t) => sum + (parseInt(editMap[t.id], 10) || 0), 0);
  const totalTps = tpsRows.length;

  const handleAddYear = () => {
    const year = parseInt(newYear, 10);
    if (!year || year < 1900 || year > 2100) {
      toast({ title: 'Tahun tidak valid', variant: 'destructive' });
      return;
    }
    setActiveYear(year);
    setNewYear('');
    setAddingYear(false);
  };

  const saveKelurahan = async (kelurahanId, tpsList) => {
    setSavingKelurahan(kelurahanId);
    const rows = tpsList.map((t) => ({
      tps_id: t.id,
      tahun: activeYear,
      jumlah: Math.max(0, parseInt(editMap[t.id], 10) || 0),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('pemilih_dpt_periode').upsert(rows, { onConflict: 'tps_id,tahun' });
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tersimpan', description: `Data pemilih ${activeYear} berhasil diperbarui.` });
      fetchAll();
    }
    setSavingKelurahan(null);
  };

  if (loading || !activeYear) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="p-page-title">Data Pemilih Sebelumnya (DPT)</h1>
      <p className="p-page-subtitle">
        Input dan kelola jumlah pemilih (DPT) per periode/tahun pemilu, per TPS di setiap kelurahan/desa.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setActiveYear(y)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 11, border: '1.5px solid ' + (activeYear === y ? '#dc2626' : 'var(--p-border)'),
              background: activeYear === y ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#fff',
              color: activeYear === y ? '#fff' : '#4b5563',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.16s',
            }}
          >
            Data {y}
          </button>
        ))}

        {addingYear ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              autoFocus
              className="p-input"
              style={{ width: 110, padding: '8px 10px' }}
              placeholder="Tahun"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddYear()}
            />
            <button className="p-btn-primary" style={{ padding: '9px 14px' }} onClick={handleAddYear}>Tambah</button>
            <button className="p-btn-ghost" style={{ padding: '9px 14px' }} onClick={() => { setAddingYear(false); setNewYear(''); }}>Batal</button>
          </div>
        ) : (
          <button className="p-btn-ghost" onClick={() => setAddingYear(true)}>
            <Plus size={15} /> Tambah Periode Tahun
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatPill icon={Users} label={`Total Pemilih ${activeYear}`} value={grandTotal} />
        <StatPill icon={ListChecks} label="Total TPS" value={totalTps} />
        <StatPill icon={MapPin} label="Total Kelurahan" value={kelurahanList.length} />
      </div>

      {kelurahanList.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada data kelurahan.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grouped.map(({ kelurahan, tps }) => (
            <div key={kelurahan.id} className="p-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a1d29' }}>{kelurahan.nama}</h3>
                <span className="p-badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  Subtotal: {subtotal(tps).toLocaleString('id-ID')} pemilih
                </span>
              </div>

              {tps.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>
                  Belum ada TPS untuk kelurahan ini.{' '}
                  <Link to="/pemilih/setup?tab=tps" style={{ color: '#dc2626', fontWeight: 600 }}>
                    <Settings size={12} style={{ display: 'inline', marginRight: 3 }} />
                    Atur jumlah TPS di menu Setup
                  </Link>
                </p>
              ) : (
                <>
                  <div className="p-table-wrap">
                    <table className="p-table">
                      <thead>
                        <tr>
                          <th style={{ width: 100 }}>TPS</th>
                          <th>Jumlah Pemilih {activeYear}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tps.sort((a, b) => a.nomor_tps - b.nomor_tps).map((t) => (
                          <tr key={t.id}>
                            <td>TPS {t.nomor_tps}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="p-input"
                                style={{ maxWidth: 160 }}
                                value={editMap[t.id] ?? ''}
                                onChange={(e) => setEditMap((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="p-btn-primary"
                      disabled={savingKelurahan === kelurahan.id}
                      onClick={() => saveKelurahan(kelurahan.id, tps)}
                    >
                      {savingKelurahan === kelurahan.id ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan {kelurahan.nama}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PemilihDataDpt;
