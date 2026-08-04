import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllRows } from '@/lib/supabasePaginate';
import PemilihSelect from './PemilihSelect';
import {
  Loader2, Plus, Trash2, Pencil, Check, X, MapPin, ListChecks, Users, Save, Info,
} from 'lucide-react';

// Panel setup "sekali jalan" untuk modul Suara PKS: kelola Dapil/Kecamatan,
// Kelurahan + jumlah TPS-nya, dan daftar Caleg — semuanya di satu halaman
// supaya menyiapkan dapil baru dari nol tidak perlu lompat-lompat menu.
//
// `manageDapil` (default true) mengontrol apakah bagian Dapil/Kecamatan bisa
// ditambah/ubah/hapus di sini. Akun DPC (lihat PemilihDpcApp) memakai
// komponen yang sama tapi dengan manageDapil=false — dapilnya sudah
// ditentukan admin saat akun dibuat, jadi hanya ditampilkan sebagai label.
const PemilihSuaraPksSetup = ({
  dapilList, selectedDapil, onSelectDapil, kelurahanList, calegMasterRows, knownYears, voteCandidateRows, defaultYear, toast, onChanged, manageDapil = true,
}) => {
  // Tahun pemilu dipakai bersama oleh Daftar Caleg maupun Kelurahan/Jumlah
  // TPS — jumlah TPS per kelurahan bisa berbeda tiap periode, jadi kedua
  // bagian itu harus selalu melihat tahun yang sama, bukan masing-masing
  // punya pilihan tahun sendiri-sendiri.
  const [year, setYear] = useState(defaultYear);
  useEffect(() => { setYear(defaultYear); }, [selectedDapil, defaultYear]);

  // Tahun di dropdown ini tidak boleh cuma dari roster caleg (calegMasterRows)
  // — dapil lama yang sudah punya data suara sebelum fitur roster ini ada
  // (mis. Pileg 2019/2024) belum tentu punya baris roster sama sekali, jadi
  // knownYears (tahun-tahun yang sudah ada data suaranya) ikut disertakan
  // supaya tahun itu tetap bisa dipilih.
  const yearOptions = useMemo(() => {
    const years = new Set(calegMasterRows.map((c) => c.election_year));
    (knownYears || []).forEach((y) => years.add(y));
    years.add(year);
    return Array.from(years).sort((a, b) => b - a);
  }, [calegMasterRows, knownYears, year]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="p-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <Info size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12.5, color: '#7c3212', lineHeight: 1.5 }}>
          {manageDapil ? (
            <>
              Urutan setup dapil baru: <strong>1)</strong> tambah Dapil/Kecamatan, <strong>2)</strong> pilih tahun pemilu &amp; daftarkan nomor/nama Caleg,
              <strong> 3)</strong> tambah Kelurahan/Desa beserta jumlah TPS-nya untuk tahun itu. Setelah itu data suara bisa diisi lewat tab Upload PDF atau Input Manual.
            </>
          ) : (
            <>
              Urutan setup: <strong>1)</strong> pilih tahun pemilu &amp; daftarkan nomor/nama Caleg, <strong>2)</strong> tambah Kelurahan/Desa beserta jumlah TPS-nya untuk tahun itu.
              Setelah itu nilai suara per TPS bisa diisi di tab Input Suara per TPS.
            </>
          )}
        </p>
      </div>

      {manageDapil ? (
        <DapilSection dapilList={dapilList} selectedDapil={selectedDapil} onSelectDapil={onSelectDapil} toast={toast} onChanged={onChanged} />
      ) : (
        <div className="p-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapPin size={16} color="#ea580c" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dapil / Kecamatan Anda</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1d29' }}>{dapilList.find((d) => d.id === selectedDapil)?.nama || '-'}</div>
          </div>
        </div>
      )}

      {selectedDapil ? (
        <>
          <div className="p-card" style={{ padding: 20, maxWidth: 260 }}>
            <label className="p-label">Tahun Pemilu</label>
            <PemilihSelect
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
              title="Pilih Tahun Pemilu"
            />
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af' }}>Daftar caleg dan jumlah TPS di bawah ini berlaku untuk tahun ini.</p>
          </div>

          <CalegSection
            selectedDapil={selectedDapil}
            kelurahanCount={kelurahanList.length}
            calegMasterRows={calegMasterRows}
            voteCandidateRows={voteCandidateRows}
            year={year}
            toast={toast}
            onChanged={onChanged}
          />
          <KelurahanTpsSection selectedDapil={selectedDapil} kelurahanList={kelurahanList} year={year} toast={toast} onChanged={onChanged} />
        </>
      ) : (
        <div className="p-card" style={{ padding: 40, textAlign: 'center' }}>
          <MapPin size={28} color="#d4d4d8" style={{ marginBottom: 8 }} />
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Tambahkan Dapil/Kecamatan terlebih dahulu di atas.</p>
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fff7ed', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
      <Icon size={15} color="#ea580c" />
    </div>
    <div>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29' }}>{title}</h3>
      {subtitle && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#9ca3af' }}>{subtitle}</p>}
    </div>
  </div>
);

const DapilSection = ({ dapilList, selectedDapil, onSelectDapil, toast, onChanged }) => {
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const addDapil = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('pemilih_kecamatan').insert({ nama: newName.trim() }).select('id').single();
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah dapil', description: error.message });
      return;
    }
    setNewName('');
    await onChanged();
    if (data?.id) onSelectDapil(data.id);
    toast({ title: 'Dapil ditambahkan' });
  };

  const saveEdit = async () => {
    if (!editValue.trim()) return;
    const { error } = await supabase.from('pemilih_kecamatan').update({ nama: editValue.trim() }).eq('id', editId);
    if (error) toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    else { setEditId(null); await onChanged(); }
  };

  const deleteDapil = async (d) => {
    if (!window.confirm(`Hapus dapil "${d.nama}"? Ini hanya bisa dilakukan kalau dapil belum punya kelurahan/desa.`)) return;
    const { error } = await supabase.from('pemilih_kecamatan').delete().eq('id', d.id);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal menghapus dapil',
        description: 'Dapil ini masih punya kelurahan/desa (atau data lain) terkait. Hapus dulu kelurahannya di bawah.',
      });
      return;
    }
    await onChanged();
  };

  return (
    <div className="p-card" style={{ padding: 20 }}>
      <SectionHeader icon={MapPin} title="Dapil / Kecamatan" subtitle="Tambahkan sebanyak yang dibutuhkan — tidak lagi terbatas satu dapil" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {dapilList.map((d) => {
          const active = d.id === selectedDapil;
          return editId === d.id ? (
            <div key={d.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="p-input" style={{ width: 180 }} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
              <button onClick={saveEdit} style={{ color: '#16a34a' }}><Check size={16} /></button>
              <button onClick={() => setEditId(null)} style={{ color: '#64748b' }}><X size={16} /></button>
            </div>
          ) : (
            <div
              key={d.id}
              className="p-badge"
              style={{
                padding: '8px 8px 8px 14px', borderRadius: 999, cursor: 'pointer',
                background: active ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#fff',
                color: active ? '#fff' : '#4b5563', border: '1.5px solid ' + (active ? '#ea580c' : 'var(--p-border)'),
                fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onClick={() => onSelectDapil(d.id)}
            >
              {d.nama}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditId(d.id); setEditValue(d.nama); }}
                style={{ display: 'inline-flex', opacity: 0.85, color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteDapil(d); }}
                style={{ display: 'inline-flex', opacity: 0.85, color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {dapilList.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Belum ada dapil.</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="p-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Nama dapil/kecamatan baru... (mis. Balikpapan Selatan)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDapil()}
        />
        <button className="p-btn-primary" onClick={addDapil} disabled={saving || !newName.trim()}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Dapil
        </button>
      </div>
    </div>
  );
};

// Jumlah TPS per kelurahan disimpan per tahun pemilu (pemilih_suara_tps_count)
// — jumlahnya memang bisa berbeda antar periode (mis. pemekaran/penggabungan
// TPS), jadi sengaja tidak dipakaikan tabel pemilih_tps yang dipakai modul
// Data Pemilih/DPT (itu global per kelurahan, tanpa tahun).
const KelurahanTpsSection = ({ selectedDapil, kelurahanList, year, toast, onChanged }) => {
  const [countRows, setCountRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNama, setNewNama] = useState('');
  const [newTps, setNewTps] = useState('');
  const [addingRow, setAddingRow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [tpsInputMap, setTpsInputMap] = useState({});
  const [savingTpsId, setSavingTpsId] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const kelurahanIds = useMemo(() => kelurahanList.map((k) => k.id), [kelurahanList]);
  const kelurahanIdsKey = kelurahanIds.join(',');

  const fetchCounts = React.useCallback(async () => {
    setLoading(true);
    if (kelurahanIds.length === 0 || !year) {
      setCountRows([]);
      setTpsInputMap({});
      setLoading(false);
      return;
    }
    const { data } = await fetchAllRows(() =>
      supabase.from('pemilih_suara_tps_count').select('kelurahan_id, election_year, jumlah_tps').eq('election_year', year).in('kelurahan_id', kelurahanIds)
    );
    setCountRows(data || []);
    const map = {};
    (data || []).forEach((r) => { map[r.kelurahan_id] = String(r.jumlah_tps); });
    setTpsInputMap(map);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelurahanIdsKey, year]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Kelurahan yang belum punya baris jumlah TPS untuk tahun ini tapi sudah
  // punya data suara per TPS asli (dapil lama, diinput sebelum fitur ini
  // ada) — isikan otomatis dari nomor TPS tertinggi yang ditemukan di data
  // itu, sekali saja, supaya jumlah TPS-nya tidak diam-diam kosong/0.
  useEffect(() => {
    if (seeding || loading || kelurahanIds.length === 0 || !year) return;
    const missingIds = kelurahanIds.filter((id) => !countRows.some((r) => r.kelurahan_id === id));
    if (missingIds.length === 0) return;
    setSeeding(true);
    supabase
      .rpc('pemilih_suara_tps_discover', { p_kelurahan_ids: missingIds, p_election_year: year })
      .then(({ data, error }) => {
        if (error) {
          setSeeding(false);
          toast({ variant: 'destructive', title: 'Gagal memuat jumlah TPS dari data suara', description: error.message });
          return;
        }
        const payload = (data || [])
          .filter((d) => d.max_tps_number)
          .map((d) => ({ kelurahan_id: d.kelurahan_id, election_year: year, jumlah_tps: d.max_tps_number }));
        if (payload.length === 0) { setSeeding(false); return; }
        supabase
          .from('pemilih_suara_tps_count')
          .upsert(payload, { onConflict: 'kelurahan_id,election_year' })
          .then(({ error: upsertError }) => {
            setSeeding(false);
            if (upsertError) {
              toast({ variant: 'destructive', title: 'Gagal memuat jumlah TPS dari data suara', description: upsertError.message });
              return;
            }
            fetchCounts();
          });
      });
  }, [seeding, loading, countRows, kelurahanIds, year, toast, fetchCounts]);

  const currentCount = (kelurahanId) => countRows.find((r) => r.kelurahan_id === kelurahanId)?.jumlah_tps ?? 0;

  const saveJumlahTps = async (kelurahanId) => {
    const target = parseInt(tpsInputMap[kelurahanId], 10);
    if (Number.isNaN(target) || target < 0) {
      toast({ variant: 'destructive', title: 'Jumlah TPS tidak valid' });
      return;
    }
    setSavingTpsId(kelurahanId);
    const { error } = await supabase
      .from('pemilih_suara_tps_count')
      .upsert({ kelurahan_id: kelurahanId, election_year: year, jumlah_tps: target }, { onConflict: 'kelurahan_id,election_year' });
    setSavingTpsId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan jumlah TPS', description: error.message });
      return;
    }
    await fetchCounts();
  };

  const addKelurahan = async () => {
    if (!newNama.trim()) return;
    setAddingRow(true);
    const { data, error } = await supabase
      .from('pemilih_kelurahan')
      .insert({ nama: newNama.trim(), kecamatan_id: selectedDapil })
      .select('id')
      .single();
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah kelurahan', description: error.message });
      setAddingRow(false);
      return;
    }
    const tpsCount = parseInt(newTps, 10);
    if (data?.id && !Number.isNaN(tpsCount) && tpsCount > 0) {
      const { error: countError } = await supabase
        .from('pemilih_suara_tps_count')
        .upsert({ kelurahan_id: data.id, election_year: year, jumlah_tps: tpsCount }, { onConflict: 'kelurahan_id,election_year' });
      if (countError) toast({ variant: 'destructive', title: 'Kelurahan tersimpan, tapi gagal menyimpan jumlah TPS', description: countError.message });
    }
    setNewNama('');
    setNewTps('');
    setAddingRow(false);
    await onChanged();
    await fetchCounts();
    toast({ title: 'Kelurahan ditambahkan' });
  };

  const startEdit = (k) => { setEditId(k.id); setEditValue(k.nama); };
  const saveEdit = async () => {
    if (!editValue.trim()) return;
    const { error } = await supabase.from('pemilih_kelurahan').update({ nama: editValue.trim() }).eq('id', editId);
    if (error) toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    else { setEditId(null); await onChanged(); }
  };

  const deleteKelurahan = async (k) => {
    if (!window.confirm(`Hapus kelurahan "${k.nama}"? Jumlah TPS dan data suara di kelurahan ini juga akan ikut terhapus/terputus.`)) return;
    const { error } = await supabase.from('pemilih_kelurahan').delete().eq('id', k.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
    else { await onChanged(); await fetchCounts(); }
  };

  return (
    <div className="p-card" style={{ padding: 20 }}>
      <SectionHeader icon={ListChecks} title={`Kelurahan/Desa & Jumlah TPS — Tahun ${year}`} subtitle="Untuk dapil yang sedang aktif — nama kelurahan berlaku semua tahun, jumlah TPS bisa berbeda tiap tahun pemilu" />

      {loading || seeding ? (
        <div style={{ padding: 30, textAlign: 'center' }}>
          <Loader2 className="animate-spin" size={22} color="#ea580c" />
          {seeding && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>Memuat jumlah TPS dari data suara yang sudah ada...</p>}
        </div>
      ) : kelurahanList.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>Belum ada kelurahan/desa untuk dapil ini.</p>
      ) : (
        <div className="p-table-wrap" style={{ marginBottom: 16 }}>
          <table className="p-table">
            <thead>
              <tr>
                <th>Kelurahan/Desa</th>
                <th style={{ width: 220 }}>Jumlah TPS ({year})</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {kelurahanList.map((k) => (
                <tr key={k.id}>
                  <td>
                    {editId === k.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="p-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                        <button onClick={saveEdit} style={{ color: '#16a34a' }}><Check size={16} /></button>
                        <button onClick={() => setEditId(null)} style={{ color: '#64748b' }}><X size={16} /></button>
                      </div>
                    ) : (
                      <span onClick={() => startEdit(k)} style={{ cursor: 'pointer' }} title="Klik untuk ubah nama">
                        {k.nama} <Pencil size={11} style={{ opacity: 0.4, marginLeft: 4 }} />
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 62 }}>{currentCount(k.id)} TPS saat ini</span>
                      <input
                        type="number" min="0" className="p-input" style={{ width: 70 }}
                        value={tpsInputMap[k.id] ?? ''}
                        onChange={(e) => setTpsInputMap((prev) => ({ ...prev, [k.id]: e.target.value }))}
                      />
                      <button
                        className="p-btn-ghost" style={{ padding: '7px 10px' }}
                        disabled={savingTpsId === k.id}
                        onClick={() => saveJumlahTps(k.id)}
                      >
                        {savingTpsId === k.id ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => deleteKelurahan(k)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, borderTop: kelurahanList.length ? '1px dashed var(--p-border)' : 'none' }}>
        <input
          className="p-input" style={{ flex: 2, minWidth: 180 }}
          placeholder="Nama kelurahan/desa baru..."
          value={newNama} onChange={(e) => setNewNama(e.target.value)}
        />
        <input
          type="number" min="0" className="p-input" style={{ flex: 1, minWidth: 110 }}
          placeholder={`Jumlah TPS (${year})`}
          value={newTps} onChange={(e) => setNewTps(e.target.value)}
        />
        <button className="p-btn-primary" onClick={addKelurahan} disabled={addingRow || !newNama.trim()}>
          {addingRow ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Kelurahan
        </button>
      </div>
    </div>
  );
};

const CalegSection = ({ selectedDapil, kelurahanCount, calegMasterRows, voteCandidateRows, year, toast, onChanged }) => {
  const rowsForYear = useMemo(
    () => calegMasterRows.filter((c) => c.election_year === year).sort((a, b) => a.candidate_number - b.candidate_number),
    [calegMasterRows, year]
  );

  // Caleg yang sudah punya data suara asli (mis. dari upload PDF/input manual
  // sebelum roster ini ada) tapi belum pernah didaftarkan ke roster —
  // nomor 0 dikecualikan karena itu representasi "Suara Partai tanpa calon",
  // bukan caleg sungguhan.
  const discoveredForYear = useMemo(() => {
    const map = new Map();
    (voteCandidateRows || [])
      .filter((r) => r.election_year === year && r.candidate_number !== 0 && r.candidate_name)
      .forEach((r) => {
        if (!map.has(r.candidate_number)) map.set(r.candidate_number, { candidate_number: r.candidate_number, candidate_name: r.candidate_name });
      });
    return Array.from(map.values()).sort((a, b) => a.candidate_number - b.candidate_number);
  }, [voteCandidateRows, year]);

  const [seeding, setSeeding] = useState(false);
  useEffect(() => {
    // Roster tahun ini masih kosong tapi datanya sendiri sudah ada (dapil
    // lama) — isikan roster dari nama caleg yang ditemukan di data suara,
    // sekali saja, supaya "Daftar Caleg" tidak diam-diam kosong padahal
    // datanya sudah ada.
    if (seeding || rowsForYear.length > 0 || discoveredForYear.length === 0) return;
    setSeeding(true);
    supabase
      .from('pemilih_caleg_master')
      .upsert(
        discoveredForYear.map((d) => ({
          kecamatan_id: selectedDapil,
          election_year: year,
          candidate_number: d.candidate_number,
          candidate_name: d.candidate_name,
        })),
        { onConflict: 'kecamatan_id,election_year,candidate_number' }
      )
      .then(({ error }) => {
        setSeeding(false);
        if (error) {
          toast({ variant: 'destructive', title: 'Gagal memuat caleg dari data suara', description: error.message });
          return;
        }
        onChanged();
      });
  }, [seeding, rowsForYear.length, discoveredForYear, selectedDapil, year, toast, onChanged]);

  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');

  const addCaleg = async () => {
    const num = parseInt(newNumber, 10);
    if (Number.isNaN(num) || num < 1) {
      toast({ variant: 'destructive', title: 'Nomor urut caleg tidak valid' });
      return;
    }
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Nama caleg wajib diisi' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('pemilih_caleg_master').upsert({
      kecamatan_id: selectedDapil,
      election_year: year,
      candidate_number: num,
      candidate_name: newName.trim(),
    }, { onConflict: 'kecamatan_id,election_year,candidate_number' });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah caleg', description: error.message });
      return;
    }
    setNewNumber('');
    setNewName('');
    await onChanged();
    toast({ title: 'Caleg ditambahkan' });
  };

  const startEdit = (c) => { setEditId(c.id); setEditNumber(String(c.candidate_number)); setEditName(c.candidate_name); };
  const saveEdit = async () => {
    const num = parseInt(editNumber, 10);
    if (Number.isNaN(num) || num < 1 || !editName.trim()) {
      toast({ variant: 'destructive', title: 'Nomor/nama caleg tidak valid' });
      return;
    }
    const { error } = await supabase.from('pemilih_caleg_master').update({
      candidate_number: num,
      candidate_name: editName.trim(),
    }).eq('id', editId);
    if (error) toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    else { setEditId(null); await onChanged(); }
  };

  const deleteCaleg = async (c) => {
    if (!window.confirm(`Hapus "${c.candidate_name}" dari roster caleg ${year}? Data suara yang sudah terlanjur diinput tetap tersimpan (tidak ikut terhapus).`)) return;
    const { error } = await supabase.from('pemilih_caleg_master').delete().eq('id', c.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
    else await onChanged();
  };

  return (
    <div className="p-card" style={{ padding: 20 }}>
      <SectionHeader icon={Users} title={`Daftar Caleg — Tahun ${year}`} subtitle="Nomor urut & nama caleg untuk dapil ini — bisa diisi sebelum ada data suara sama sekali" />

      {kelurahanCount === 0 && (
        <p style={{ fontSize: 12, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
          Tips: setelah caleg didaftarkan, tambahkan juga minimal satu kelurahan di bawah supaya data suaranya bisa langsung diisi.
        </p>
      )}

      {seeding ? (
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Loader2 className="animate-spin" size={13} /> Memuat caleg dari data suara yang sudah ada...
        </p>
      ) : rowsForYear.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>Belum ada caleg terdaftar untuk tahun {year}.</p>
      ) : (
        <div className="p-table-wrap" style={{ marginBottom: 16 }}>
          <table className="p-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Nomor Urut</th>
                <th>Nama Caleg</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rowsForYear.map((c) => (
                <tr key={c.id}>
                  {editId === c.id ? (
                    <>
                      <td><input type="number" min="1" className="p-input" style={{ width: 70 }} value={editNumber} onChange={(e) => setEditNumber(e.target.value)} /></td>
                      <td><input className="p-input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus /></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={saveEdit} style={{ color: '#16a34a', marginRight: 8 }}><Check size={16} /></button>
                        <button onClick={() => setEditId(null)} style={{ color: '#64748b' }}><X size={16} /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 700 }}>{c.candidate_number}</td>
                      <td>{c.candidate_name}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(c)} style={{ color: '#2563eb', marginRight: 8 }}><Pencil size={15} /></button>
                        <button onClick={() => deleteCaleg(c)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, borderTop: rowsForYear.length ? '1px dashed var(--p-border)' : 'none' }}>
        <input
          type="number" min="1" className="p-input" style={{ width: 100 }}
          placeholder="No. urut"
          value={newNumber} onChange={(e) => setNewNumber(e.target.value)}
        />
        <input
          className="p-input" style={{ flex: 1, minWidth: 200 }}
          placeholder="Nama lengkap caleg..."
          value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCaleg()}
        />
        <button className="p-btn-primary" onClick={addCaleg} disabled={saving || !newNumber || !newName.trim()}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Caleg
        </button>
      </div>
    </div>
  );
};

export default PemilihSuaraPksSetup;
