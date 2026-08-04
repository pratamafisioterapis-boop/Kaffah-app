import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllRows } from '@/lib/supabasePaginate';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save } from 'lucide-react';

const PemilihSetupTps = () => {
  const { toast } = useToast();
  const [kelurahanList, setKelurahanList] = useState([]);
  const [tpsRows, setTpsRows] = useState([]);
  const [inputMap, setInputMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data: kel } = await supabase.from('pemilih_kelurahan').select('id, nama').order('nama');
    // Tanpa paginasi eksplisit, select ini kena batas 1000 baris PostgREST —
    // satu kecamatan saja sudah >500 TPS di data produksi.
    const { data: tps } = await fetchAllRows(() => supabase.from('pemilih_tps').select('id, kelurahan_id, nomor_tps'));
    setKelurahanList(kel || []);
    setTpsRows(tps || []);
    const counts = {};
    (kel || []).forEach((k) => {
      counts[k.id] = String((tps || []).filter((t) => t.kelurahan_id === k.id).length);
    });
    setInputMap(counts);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const currentCount = (kelurahanId) => tpsRows.filter((t) => t.kelurahan_id === kelurahanId).length;

  const saveJumlahTps = async (kelurahanId) => {
    const target = parseInt(inputMap[kelurahanId], 10);
    if (Number.isNaN(target) || target < 0) {
      toast({ title: 'Jumlah TPS tidak valid', variant: 'destructive' });
      return;
    }
    const existing = tpsRows.filter((t) => t.kelurahan_id === kelurahanId).sort((a, b) => a.nomor_tps - b.nomor_tps);

    if (target === existing.length) return;

    setSavingId(kelurahanId);

    if (target > existing.length) {
      const toInsert = [];
      for (let n = existing.length + 1; n <= target; n++) {
        toInsert.push({ kelurahan_id: kelurahanId, nomor_tps: n });
      }
      const { error } = await supabase.from('pemilih_tps').insert(toInsert);
      if (error) toast({ title: 'Gagal menambah TPS', description: error.message, variant: 'destructive' });
    } else {
      const toRemove = existing.slice(target);
      const confirmMsg = `Mengurangi jumlah TPS akan menghapus ${toRemove.length} TPS terakhir beserta data jumlah pemilih 2024 yang sudah diisi untuk TPS tersebut. Lanjutkan?`;
      if (!window.confirm(confirmMsg)) {
        setInputMap((prev) => ({ ...prev, [kelurahanId]: String(existing.length) }));
        setSavingId(null);
        return;
      }
      const { error } = await supabase.from('pemilih_tps').delete().in('id', toRemove.map((r) => r.id));
      if (error) toast({ title: 'Gagal mengurangi TPS', description: error.message, variant: 'destructive' });
    }

    await fetchAll();
    setSavingId(null);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="p-page-title">Setup Jumlah TPS</h1>
      <p className="p-page-subtitle">
        Atur jumlah TPS untuk setiap kelurahan/desa. Jumlah TPS di tiap kelurahan bisa berbeda-beda. TPS yang dibuat di sini akan muncul di menu <strong>Data DPT</strong> untuk diisi jumlah pemilihnya per tahun.
      </p>

      <div className="p-card" style={{ padding: 20 }}>
        {kelurahanList.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>
            Belum ada data kelurahan. Tambahkan kelurahan di tab Wilayah terlebih dahulu.
          </p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Kelurahan/Desa</th>
                  <th style={{ width: 140 }}>Jumlah TPS Saat Ini</th>
                  <th style={{ width: 220 }}>Atur Jumlah TPS</th>
                </tr>
              </thead>
              <tbody>
                {kelurahanList.map((k) => (
                  <tr key={k.id}>
                    <td>{k.nama}</td>
                    <td>{currentCount(k.id)} TPS</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          min="0"
                          className="p-input"
                          style={{ width: 90 }}
                          value={inputMap[k.id] ?? ''}
                          onChange={(e) => setInputMap((prev) => ({ ...prev, [k.id]: e.target.value }))}
                        />
                        <button
                          className="p-btn-primary"
                          style={{ padding: '9px 14px' }}
                          disabled={savingId === k.id}
                          onClick={() => saveJumlahTps(k.id)}
                        >
                          {savingId === k.id ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Simpan
                        </button>
                      </div>
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

export default PemilihSetupTps;
