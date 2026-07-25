import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Users, MapPin, ListChecks, Settings } from 'lucide-react';

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

const PemilihData2024 = () => {
  const { toast } = useToast();
  const [kelurahanList, setKelurahanList] = useState([]);
  const [tpsRows, setTpsRows] = useState([]);
  const [editMap, setEditMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKelurahan, setSavingKelurahan] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data: kel } = await supabase.from('pemilih_kelurahan').select('id, nama').order('nama');
    const { data: tps } = await supabase
      .from('pemilih_tps')
      .select('id, kelurahan_id, nomor_tps, jumlah_dpt_2024')
      .order('nomor_tps');
    setKelurahanList(kel || []);
    setTpsRows(tps || []);
    const initial = {};
    (tps || []).forEach((t) => { initial[t.id] = String(t.jumlah_dpt_2024 ?? 0); });
    setEditMap(initial);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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

  const saveKelurahan = async (kelurahanId, tpsList) => {
    setSavingKelurahan(kelurahanId);
    const updates = tpsList.map((t) => {
      const value = Math.max(0, parseInt(editMap[t.id], 10) || 0);
      return supabase.from('pemilih_tps').update({ jumlah_dpt_2024: value, updated_at: new Date().toISOString() }).eq('id', t.id);
    });
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed) {
      toast({ title: 'Gagal menyimpan', description: failed.error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tersimpan', description: 'Data pemilih 2024 berhasil diperbarui.' });
      fetchAll();
    }
    setSavingKelurahan(null);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="p-page-title">Data Pemilih 2024</h1>
      <p className="p-page-subtitle">
        Input dan kelola jumlah pemilih (DPT) tahun 2024 per TPS di setiap kelurahan/desa.
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatPill icon={Users} label="Total Pemilih 2024" value={grandTotal} />
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
                          <th>Jumlah Pemilih 2024</th>
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

export default PemilihData2024;
