import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import PemilihSelect from '../pemilih/PemilihSelect';
import { Loader2, Plus, Pencil, Trash2, Save, X, Table2 } from 'lucide-react';

const TPS_TABLE_BORDER = '#9aa1ab';
const PASTEL_COLUMN_COLORS = [
  '#FFE3E3', '#FFE8CC', '#FFF9DB', '#E9FAC8', '#D3F9D8', '#C5F6FA',
  '#D0EBFF', '#DBE4FF', '#E5DBFF', '#F3D9FA', '#FFDEEB', '#F1F3F5',
];

// Menghitung ulang total suara per caleg (pemilih_suara_caleg) dari seluruh
// baris per-TPS (pemilih_suara_caleg_tps) untuk satu kelurahan+tahun —
// dipanggil setiap kali nilai per TPS ditambah/diedit/dihapus di sini,
// supaya total kelurahan tidak pernah basi dibanding rincian per TPS-nya.
const syncKelurahanTotals = async (kelurahanId, year, candidateMasterList) => {
  const { data: allTpsRows, error: fetchError } = await supabase
    .from('pemilih_suara_caleg_tps')
    .select('candidate_number, votes')
    .eq('kelurahan_id', kelurahanId)
    .eq('election_year', year);
  if (fetchError) return fetchError;

  const totals = new Map();
  candidateMasterList.forEach((c) => totals.set(c.number, 0));
  (allTpsRows || []).forEach((r) => {
    totals.set(r.candidate_number, (totals.get(r.candidate_number) || 0) + (r.votes || 0));
  });

  const { data: authData } = await supabase.auth.getUser();
  const nameByNumber = new Map(candidateMasterList.map((c) => [c.number, c.number === 0 ? null : c.name]));
  const payload = Array.from(totals.entries()).map(([number, total]) => ({
    kelurahan_id: kelurahanId,
    party_name: 'Partai Keadilan Sejahtera',
    candidate_number: number,
    candidate_name: nameByNumber.get(number) ?? null,
    total_suara: total,
    election_year: year,
    updated_by: authData?.user?.id || null,
    updated_at: new Date().toISOString(),
  }));
  if (payload.length === 0) return null;
  const { error } = await supabase.from('pemilih_suara_caleg').upsert(payload, { onConflict: 'kelurahan_id,candidate_number,election_year' });
  return error;
};

// Input Suara per TPS untuk akun DPC — sama fungsinya dengan tab "Detail per
// TPS" di modul admin (tambah/koreksi angka per TPS), ditambah kemampuan
// menghapus satu TPS sekaligus, TANPA grafik apapun.
const PemilihDpcTpsInput = ({ selectedDapil, kelurahanList, calegMasterRows, defaultYear, toast }) => {
  const [year, setYear] = useState(defaultYear);
  useEffect(() => { setYear(defaultYear); }, [defaultYear]);

  const yearOptions = useMemo(() => {
    const years = new Set(calegMasterRows.map((c) => c.election_year));
    years.add(year);
    return Array.from(years).sort((a, b) => b - a);
  }, [calegMasterRows, year]);

  // Nomor 0 (Suara Partai tanpa calon) selalu tersedia sebagai kolom input,
  // di luar caleg yang terdaftar di roster.
  const candidateMasterList = useMemo(() => {
    const map = new Map([[0, { number: 0, name: 'Suara Partai' }]]);
    calegMasterRows
      .filter((c) => c.election_year === year)
      .forEach((c) => map.set(c.candidate_number, { number: c.candidate_number, name: c.candidate_name }));
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [calegMasterRows, year]);

  const [kelurahanId, setKelurahanId] = useState('');
  useEffect(() => {
    if (kelurahanList.length === 0) { if (kelurahanId) setKelurahanId(''); return; }
    if (!kelurahanList.some((k) => k.id === kelurahanId)) setKelurahanId(kelurahanList[0].id);
  }, [kelurahanList, kelurahanId]);

  const [loading, setLoading] = useState(false);
  const [tpsRows, setTpsRows] = useState([]);
  const [editingTps, setEditingTps] = useState(null);
  const [addingTps, setAddingTps] = useState(false);
  const [savingTps, setSavingTps] = useState(false);
  const [deletingTps, setDeletingTps] = useState(null);

  const reloadTpsRows = React.useCallback(async () => {
    if (!kelurahanId || !year) { setTpsRows([]); return; }
    setLoading(true);
    const pageSize = 1000;
    let allRows = [];
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('pemilih_suara_caleg_tps')
        .select('tps_number, candidate_number, candidate_name, votes')
        .eq('kelurahan_id', kelurahanId)
        .eq('election_year', year)
        .order('tps_number')
        .range(from, from + pageSize - 1);
      if (error) {
        toast({ variant: 'destructive', title: 'Gagal memuat data per TPS', description: error.message });
        setTpsRows([]);
        setLoading(false);
        return;
      }
      allRows = allRows.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    setTpsRows(allRows);
    setLoading(false);
  }, [kelurahanId, year, toast]);

  useEffect(() => { reloadTpsRows(); }, [reloadTpsRows]);

  const table = useMemo(() => {
    const byTps = new Map();
    tpsRows.forEach((r) => {
      if (!byTps.has(r.tps_number)) byTps.set(r.tps_number, { tps: r.tps_number, byCandidate: {}, total: 0 });
      const row = byTps.get(r.tps_number);
      row.byCandidate[r.candidate_number] = r.votes;
      row.total += r.votes || 0;
    });
    return Array.from(byTps.values()).sort((a, b) => a.tps - b.tps);
  }, [tpsRows]);

  const candidateColorMap = useMemo(() => {
    const map = {};
    candidateMasterList.forEach((c, i) => { map[c.number] = PASTEL_COLUMN_COLORS[i % PASTEL_COLUMN_COLORS.length]; });
    return map;
  }, [candidateMasterList]);

  const columnTotals = useMemo(() => {
    const byCandidate = {};
    candidateMasterList.forEach((c) => { byCandidate[c.number] = 0; });
    let total = 0;
    table.forEach((r) => {
      candidateMasterList.forEach((c) => { byCandidate[c.number] += r.byCandidate[c.number] || 0; });
      total += r.total;
    });
    return { byCandidate, total };
  }, [table, candidateMasterList]);

  const openEditTps = (row) => {
    const values = {};
    candidateMasterList.forEach((c) => { values[c.number] = row.byCandidate[c.number] ?? ''; });
    setEditingTps({ tps: row.tps, values });
    setAddingTps(false);
  };

  const openAddTps = () => {
    const nextTps = table.length > 0 ? Math.max(...table.map((r) => r.tps)) + 1 : 1;
    const values = {};
    candidateMasterList.forEach((c) => { values[c.number] = ''; });
    setEditingTps({ tps: nextTps, values });
    setAddingTps(true);
  };

  const saveEditingTps = async () => {
    if (!editingTps) return;
    const tpsNumber = Number(editingTps.tps);
    if (!tpsNumber || tpsNumber < 1) {
      toast({ variant: 'destructive', title: 'Nomor TPS tidak valid' });
      return;
    }
    setSavingTps(true);
    const payload = candidateMasterList.map((c) => ({
      kelurahan_id: kelurahanId,
      tps_number: tpsNumber,
      candidate_number: c.number,
      candidate_name: c.number === 0 ? null : c.name,
      votes: Number(editingTps.values[c.number]) || 0,
      election_year: year,
    }));
    const { error } = await supabase
      .from('pemilih_suara_caleg_tps')
      .upsert(payload, { onConflict: 'kelurahan_id,tps_number,candidate_number,election_year' });
    if (error) {
      setSavingTps(false);
      toast({ variant: 'destructive', title: 'Gagal menyimpan TPS', description: error.message });
      return;
    }
    const syncError = await syncKelurahanTotals(kelurahanId, year, candidateMasterList);
    setSavingTps(false);
    if (syncError) {
      toast({ variant: 'destructive', title: 'TPS tersimpan, tapi gagal memperbarui total', description: syncError.message });
    } else {
      toast({ title: `TPS ${String(tpsNumber).padStart(2, '0')} tersimpan` });
    }
    setEditingTps(null);
    reloadTpsRows();
  };

  const confirmDeleteTps = async () => {
    if (!deletingTps) return;
    setSavingTps(true);
    const { error } = await supabase
      .from('pemilih_suara_caleg_tps')
      .delete()
      .eq('kelurahan_id', kelurahanId)
      .eq('election_year', year)
      .eq('tps_number', deletingTps);
    if (error) {
      setSavingTps(false);
      toast({ variant: 'destructive', title: 'Gagal menghapus TPS', description: error.message });
      return;
    }
    const syncError = await syncKelurahanTotals(kelurahanId, year, candidateMasterList);
    setSavingTps(false);
    if (syncError) {
      toast({ variant: 'destructive', title: 'TPS terhapus, tapi gagal memperbarui total', description: syncError.message });
    } else {
      toast({ title: `TPS ${String(deletingTps).padStart(2, '0')} dihapus` });
    }
    setDeletingTps(null);
    reloadTpsRows();
  };

  const selectedKelurahanName = kelurahanList.find((k) => k.id === kelurahanId)?.nama || '';

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ minWidth: 220 }}>
          <label className="p-label">Kelurahan</label>
          <PemilihSelect
            value={kelurahanId}
            onChange={setKelurahanId}
            options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
            placeholder="Pilih Kelurahan"
            title="Pilih Kelurahan"
          />
        </div>
        <div style={{ minWidth: 140 }}>
          <label className="p-label">Tahun Pemilu</label>
          <PemilihSelect
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
            title="Pilih Tahun Pemilu"
          />
        </div>
      </div>

      {kelurahanList.length === 0 ? (
        <div className="p-card" style={{ padding: 50, textAlign: 'center' }}>
          <Table2 size={32} color="#d4d4d8" style={{ marginBottom: 10 }} />
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
            Dapil ini belum punya kelurahan. Tambahkan dulu di tab Setup Dapil.
          </p>
        </div>
      ) : loading ? (
        <div style={{ padding: 80, textAlign: 'center' }}><Loader2 className="animate-spin" size={30} color="#ea580c" /></div>
      ) : (
        <div className="p-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29' }}>Rincian per TPS — {selectedKelurahanName}</h3>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#9ca3af' }}>{table.length} TPS tercatat untuk tahun {year}</p>
            </div>
            <button className="p-btn-ghost" onClick={openAddTps} style={{ flexShrink: 0 }}>
              <Plus size={14} /> Tambah TPS
            </button>
          </div>

          {table.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Belum ada TPS diisi untuk kelurahan/tahun ini.</p>
          ) : (
            <div className="p-table-wrap p-table-wrap-scroll">
              <table className="p-table" style={{ minWidth: 0, border: `1px solid ${TPS_TABLE_BORDER}` }}>
                <thead className="p-table-sticky-head">
                  <tr>
                    <th style={{ width: 44, textAlign: 'center', verticalAlign: 'middle', fontWeight: 900, color: '#1a1d29', border: `1px solid ${TPS_TABLE_BORDER}` }}>TPS</th>
                    {candidateMasterList.map((c) => (
                      <th
                        key={c.number}
                        style={{
                          textAlign: 'center', whiteSpace: 'normal', minWidth: 90, fontSize: 11, lineHeight: 1.25,
                          verticalAlign: 'middle', fontWeight: 900, color: '#1a1d29', padding: '10px 8px',
                          border: `1px solid ${TPS_TABLE_BORDER}`, background: candidateColorMap[c.number],
                        }}
                        title={c.number === 0 ? 'Suara Partai (tanpa calon)' : c.name}
                      >
                        {c.number === 0 ? 'Partai' : c.name}
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', width: 60, fontWeight: 900, color: '#1a1d29', border: `1px solid ${TPS_TABLE_BORDER}` }}>Total</th>
                    <th style={{ width: 60, border: `1px solid ${TPS_TABLE_BORDER}` }}></th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr key={r.tps}>
                      <td style={{ fontWeight: 700, padding: '10px 6px', textAlign: 'center', border: `1px solid ${TPS_TABLE_BORDER}` }}>{String(r.tps).padStart(2, '0')}</td>
                      {candidateMasterList.map((c) => (
                        <td key={c.number} style={{ textAlign: 'center', fontFamily: 'monospace', color: '#4b5563', padding: '10px 4px', fontSize: 12, border: `1px solid ${TPS_TABLE_BORDER}`, background: candidateColorMap[c.number] }}>
                          {r.byCandidate[c.number] ?? '-'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 800, padding: '10px 4px', border: `1px solid ${TPS_TABLE_BORDER}` }}>{r.total.toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'center', padding: '10px 4px', border: `1px solid ${TPS_TABLE_BORDER}`, whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEditTps(r)} style={{ color: '#2563eb', padding: 4 }} title="Koreksi angka TPS ini">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeletingTps(r.tps)} style={{ color: '#dc2626', padding: 4 }} title="Hapus TPS ini">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 800, padding: '10px 6px', textAlign: 'center', border: `1px solid ${TPS_TABLE_BORDER}` }}>Total</td>
                    {candidateMasterList.map((c) => (
                      <td key={c.number} style={{ textAlign: 'center', fontWeight: 800, padding: '10px 4px', fontSize: 12, border: `1px solid ${TPS_TABLE_BORDER}`, background: candidateColorMap[c.number] }}>
                        {columnTotals.byCandidate[c.number].toLocaleString('id-ID')}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, padding: '10px 4px', border: `1px solid ${TPS_TABLE_BORDER}` }}>{columnTotals.total.toLocaleString('id-ID')}</td>
                    <td style={{ border: `1px solid ${TPS_TABLE_BORDER}` }}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p style={{ margin: '10px 0 0', fontSize: 10.5, color: '#9ca3af' }}>
            Kolom "Partai" menunjukkan suara partai tanpa calon; baris terakhir adalah total seluruh TPS.
          </p>
        </div>
      )}

      {editingTps && (
        <div className="p-modal-overlay" onClick={() => setEditingTps(null)}>
          <div className="p-modal" style={{ padding: 26, width: 440, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 15.5 }}>
                {addingTps ? 'Tambah TPS' : `Koreksi TPS ${String(editingTps.tps).padStart(2, '0')}`}
              </h3>
              <button onClick={() => setEditingTps(null)} style={{ color: '#9ca3af' }}><X size={19} /></button>
            </div>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 12.5 }}>
              {selectedKelurahanName} — Tahun {year}. Kosongkan/isi 0 kalau tidak ada suara.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addingTps && (
                <div>
                  <label className="p-label">Nomor TPS</label>
                  <input
                    type="number" className="p-input" min={1}
                    value={editingTps.tps}
                    onChange={(e) => setEditingTps({ ...editingTps, tps: e.target.value })}
                  />
                </div>
              )}
              <div className="p-scrollbar" style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                {candidateMasterList.map((c) => (
                  <div key={c.number} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ flex: 1, fontSize: 12.5, color: '#4b5563' }}>
                      {c.number === 0 ? 'Suara Partai (tanpa calon)' : `${c.number}. ${c.name}`}
                    </label>
                    <input
                      type="number" className="p-input" style={{ width: 90, textAlign: 'right' }} min={0}
                      value={editingTps.values[c.number]}
                      onChange={(e) => setEditingTps({ ...editingTps, values: { ...editingTps.values, [c.number]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <button className="p-btn-primary" style={{ marginTop: 18, width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #f97316, #ea580c)' }} onClick={saveEditingTps} disabled={savingTps}>
              {savingTps ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
            </button>
          </div>
        </div>
      )}

      {deletingTps !== null && (
        <div className="p-modal-overlay" onClick={() => setDeletingTps(null)}>
          <div className="p-modal" style={{ padding: 22, width: 380, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15 }}>Hapus TPS {String(deletingTps).padStart(2, '0')}?</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
              Semua nilai suara caleg untuk TPS ini di {selectedKelurahanName} — Tahun {year} akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="p-btn-ghost" onClick={() => setDeletingTps(null)}>Batal</button>
              <button className="p-btn-primary" style={{ background: '#dc2626' }} onClick={confirmDeleteTps} disabled={savingTps}>
                {savingTps ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PemilihDpcTpsInput;
