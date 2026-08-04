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
  dapilList, selectedDapil, onSelectDapil, kelurahanList, calegMasterRows, defaultYear, toast, onChanged, manageDapil = true,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="p-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <Info size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12.5, color: '#7c3212', lineHeight: 1.5 }}>
          {manageDapil ? (
            <>
              Urutan setup dapil baru: <strong>1)</strong> tambah Dapil/Kecamatan, <strong>2)</strong> tambah Kelurahan/Desa beserta jumlah TPS-nya,
              <strong> 3)</strong> daftarkan nomor &amp; nama Caleg. Setelah itu data suara bisa diisi lewat tab Upload PDF atau Input Manual.
            </>
          ) : (
            <>
              Urutan setup: <strong>1)</strong> tambah Kelurahan/Desa beserta jumlah TPS-nya, <strong>2)</strong> daftarkan nomor &amp; nama Caleg.
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
          <KelurahanTpsSection selectedDapil={selectedDapil} kelurahanList={kelurahanList} toast={toast} onChanged={onChanged} />
          <CalegSection selectedDapil={selectedDapil} kelurahanCount={kelurahanList.length} calegMasterRows={calegMasterRows} defaultYear={defaultYear} toast={toast} onChanged={onChanged} />
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

const KelurahanTpsSection = ({ selectedDapil, kelurahanList, toast, onChanged }) => {
  const [tpsRows, setTpsRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNama, setNewNama] = useState('');
  const [newTps, setNewTps] = useState('');
  const [addingRow, setAddingRow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [tpsInputMap, setTpsInputMap] = useState({});
  const [savingTpsId, setSavingTpsId] = useState(null);

  const kelurahanIds = useMemo(() => kelurahanList.map((k) => k.id), [kelurahanList]);

  const fetchTps = async () => {
    setLoading(true);
    if (kelurahanIds.length === 0) {
      setTpsRows([]);
      setTpsInputMap({});
      setLoading(false);
      return;
    }
    // .in('kelurahan_id', kelurahanIds) tanpa paginasi gampang lewat batas
    // 1000 baris PostgREST begitu satu dapil punya banyak kelurahan/TPS —
    // satu kecamatan saja sudah bisa >500 TPS.
    const { data } = await fetchAllRows(() =>
      supabase.from('pemilih_tps').select('id, kelurahan_id, nomor_tps').in('kelurahan_id', kelurahanIds)
    );
    setTpsRows(data || []);
    const counts = {};
    kelurahanList.forEach((k) => {
      counts[k.id] = String((data || []).filter((t) => t.kelurahan_id === k.id).length);
    });
    setTpsInputMap(counts);
    setLoading(false);
  };

  useEffect(() => {
    fetchTps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDapil, kelurahanList.length]);

  const currentCount = (kelurahanId) => tpsRows.filter((t) => t.kelurahan_id === kelurahanId).length;

  const saveJumlahTps = async (kelurahanId) => {
    const target = parseInt(tpsInputMap[kelurahanId], 10);
    if (Number.isNaN(target) || target < 0) {
      toast({ variant: 'destructive', title: 'Jumlah TPS tidak valid' });
      return;
    }
    const existing = tpsRows.filter((t) => t.kelurahan_id === kelurahanId).sort((a, b) => a.nomor_tps - b.nomor_tps);
    if (target === existing.length) return;

    setSavingTpsId(kelurahanId);
    if (target > existing.length) {
      const toInsert = [];
      for (let n = existing.length + 1; n <= target; n++) toInsert.push({ kelurahan_id: kelurahanId, nomor_tps: n });
      const { error } = await supabase.from('pemilih_tps').insert(toInsert);
      if (error) toast({ variant: 'destructive', title: 'Gagal menambah TPS', description: error.message });
    } else {
      const toRemove = existing.slice(target);
      if (!window.confirm(`Mengurangi jumlah TPS akan menghapus ${toRemove.length} TPS terakhir beserta data DPT-nya. Lanjutkan?`)) {
        setTpsInputMap((prev) => ({ ...prev, [kelurahanId]: String(existing.length) }));
        setSavingTpsId(null);
        return;
      }
      const { error } = await supabase.from('pemilih_tps').delete().in('id', toRemove.map((r) => r.id));
      if (error) toast({ variant: 'destructive', title: 'Gagal mengurangi TPS', description: error.message });
    }
    await fetchTps();
    setSavingTpsId(null);
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
      const toInsert = [];
      for (let n = 1; n <= tpsCount; n++) toInsert.push({ kelurahan_id: data.id, nomor_tps: n });
      const { error: tpsError } = await supabase.from('pemilih_tps').insert(toInsert);
      if (tpsError) toast({ variant: 'destructive', title: 'Kelurahan tersimpan, tapi gagal membuat TPS', description: tpsError.message });
    }
    setNewNama('');
    setNewTps('');
    setAddingRow(false);
    await onChanged();
    await fetchTps();
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
    if (!window.confirm(`Hapus kelurahan "${k.nama}"? Semua TPS dan data suara di kelurahan ini juga akan ikut terhapus/terputus.`)) return;
    const { error } = await supabase.from('pemilih_kelurahan').delete().eq('id', k.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
    else { await onChanged(); await fetchTps(); }
  };

  return (
    <div className="p-card" style={{ padding: 20 }}>
      <SectionHeader icon={ListChecks} title="Kelurahan/Desa & Jumlah TPS" subtitle="Untuk dapil yang sedang aktif — nama kelurahan dan jumlah TPS bisa diatur di sini sekaligus" />

      {loading ? (
        <div style={{ padding: 30, textAlign: 'center' }}><Loader2 className="animate-spin" size={22} color="#ea580c" /></div>
      ) : kelurahanList.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>Belum ada kelurahan/desa untuk dapil ini.</p>
      ) : (
        <div className="p-table-wrap" style={{ marginBottom: 16 }}>
          <table className="p-table">
            <thead>
              <tr>
                <th>Kelurahan/Desa</th>
                <th style={{ width: 220 }}>Jumlah TPS</th>
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
          placeholder="Jumlah TPS"
          value={newTps} onChange={(e) => setNewTps(e.target.value)}
        />
        <button className="p-btn-primary" onClick={addKelurahan} disabled={addingRow || !newNama.trim()}>
          {addingRow ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Kelurahan
        </button>
      </div>
    </div>
  );
};

const CalegSection = ({ selectedDapil, kelurahanCount, calegMasterRows, defaultYear, toast, onChanged }) => {
  const [year, setYear] = useState(defaultYear);
  useEffect(() => { setYear(defaultYear); }, [selectedDapil, defaultYear]);

  const yearOptions = useMemo(() => {
    const years = new Set(calegMasterRows.map((c) => c.election_year));
    years.add(year);
    return Array.from(years).sort((a, b) => b - a);
  }, [calegMasterRows, year]);

  const rowsForYear = useMemo(
    () => calegMasterRows.filter((c) => c.election_year === year).sort((a, b) => a.candidate_number - b.candidate_number),
    [calegMasterRows, year]
  );

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
      <SectionHeader icon={Users} title="Daftar Caleg" subtitle="Nomor urut & nama caleg untuk dapil ini — bisa diisi sebelum ada data suara sama sekali" />

      <div style={{ marginBottom: 16, maxWidth: 200 }}>
        <label className="p-label">Tahun Pemilu</label>
        <PemilihSelect
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
          title="Pilih Tahun Pemilu"
        />
      </div>

      {kelurahanCount === 0 && (
        <p style={{ fontSize: 12, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
          Tips: tambahkan dulu minimal satu kelurahan di atas supaya nanti data suara caleg ini bisa langsung diisi.
        </p>
      )}

      {rowsForYear.length === 0 ? (
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
