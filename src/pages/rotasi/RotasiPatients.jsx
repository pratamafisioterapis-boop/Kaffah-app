import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import RotasiPwaStyles from './RotasiPwaStyles';

// ─── helpers ────────────────────────────────────────────────────────────────
const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return '-';
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const SORT_COLS = [
  { key: 'medical_record_number', label: 'No. RM' },
  { key: 'name',                  label: 'Nama Pasien' },
  { key: 'birth_date',            label: 'Tgl Lahir' },
  { key: 'age',                   label: 'Usia' },
  { key: 'diagnosis',             label: 'Diagnosis' },
  { key: 'therapy_start_date',    label: 'Tgl Awal Terapi' },
  { key: 'bpjs_number',           label: 'No. Bpjs' },
  { key: 'insurance',             label: 'Eselon' },
  { key: 'is_active',             label: 'Status' },
];

// ─── styles ──────────────────────────────────────────────────────────────────
const S = {
  inputBase: {
    padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
  },
  btnSecondary: {
    padding: '9px 14px', background: '#f1f5f9', color: '#334155',
    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  btnEdit: {
    padding: '4px 10px', background: '#eff6ff', color: '#1d4ed8',
    border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginRight: 4,
  },
  btnDelete: {
    padding: '4px 10px', background: '#fef2f2', color: '#dc2626',
    border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  pagerBtn: {
    padding: '6px 10px', minWidth: 34, background: '#fff', color: '#334155',
    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    fontWeight: 500, transition: 'all 0.15s', lineHeight: 1,
  },
  th: {
    padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b',
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none', background: '#f8fafc',
  },
  td: { padding: '10px 12px', color: '#1e293b', fontSize: 13, borderTop: '1px solid #f1f5f9' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520,
    maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
};

const FL = ({ label, required, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
      {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
    </label>
    {children}
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────
const RotasiPatients = () => {
  const [patients, setPatients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [insuranceTypes, setInsuranceTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = React.useRef(null);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);
  const EMPTY_FORM = {
    medical_record_number: '', name: '', birth_date: '', diagnosis: '',
    therapy_start_date: '', bpjs_number: '', insurance_type_id: '', is_active: true,
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  // State modal riwayat terapi
  const [historyPatient, setHistoryPatient] = useState(null); // { id, name }
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEditing, setHistoryEditing] = useState({});
  const [historySaving, setHistorySaving] = useState(false);
  const [allTherapists, setAllTherapists] = useState([]);

  // ─── fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchInsuranceTypes();
    fetchDiagnoses();
    supabase.from('rotasi_therapists').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setAllTherapists(data);
    });
  }, []);
  useEffect(() => { fetchPatients(); }, [page, pageSize, sortKey, sortDir, search]);

  const [diagnoses, setDiagnoses] = useState([]);

  const fetchInsuranceTypes = async () => {
    const { data } = await supabase.from('rotasi_insurance_types').select('id, name').order('name', { ascending: true });
    if (data) setInsuranceTypes(data);
  };

  const fetchDiagnoses = async () => {
    const { data } = await supabase.from('rotasi_diagnoses').select('id, name').order('name', { ascending: true });
    if (data) setDiagnoses(data);
  };

  const fetchPatients = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('rotasi_patients')
      .select('id, name, is_active, birth_date, medical_record_number, bpjs_number, therapy_start_date, diagnosis, insurance_type_id, rotasi_insurance_types(name)', { count: 'exact' })
      .order(sortKey === 'insurance' ? 'name' : sortKey === 'age' ? 'birth_date' : sortKey, { ascending: sortDir === 'asc' })
      .range(from, to);

    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,medical_record_number.ilike.%${search.trim()}%,diagnosis.ilike.%${search.trim()}%`);
    }

    const { data, error, count } = await query;
    if (!error) {
      setPatients(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  // ─── derived ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginated = patients; // sudah di-server-side\

  const handleSort = (key) => {
    // kolom age dan insurance tidak bisa di-sort server-side dengan mudah, skip
    if (key === 'age' || key === 'insurance' || key === 'is_active') return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const sortIcon = (key) => {
    if (sortKey !== key) return <span style={{ opacity: 0.3, marginLeft: 3 }}>⇅</span>;
    return <span style={{ marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ─── modal ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalMode('add');
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      medical_record_number: p.medical_record_number || '',
      name: p.name || '',
      birth_date: p.birth_date || '',
      diagnosis: p.diagnosis || '',
      therapy_start_date: p.therapy_start_date || '',
      bpjs_number: p.bpjs_number || '',
      insurance_type_id: p.insurance_type_id || '',
      is_active: p.is_active !== false,
    });
    setEditId(p.id);
    setModalMode('edit');
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setSaving(false); };

  const openHistory = async (p) => {
    setHistoryPatient({ id: p.id, name: p.name });
    setHistoryEditing({});
    setHistoryLoading(true);
    const [{ data }, { data: gslots }] = await Promise.all([
      supabase
        .from('rotasi_schedule')
        .select('id, visit_date, therapist_id, slot_number, confirmed')
        .eq('patient_id', p.id)
        .eq('cancelled', false)
        .eq('confirmed', true)
        .order('visit_date', { ascending: false }),
      supabase
        .from('rotasi_global_slots')
        .select('slot_date, start_time'),
    ]);

    // Bangun peta "tanggal|urutan sesi" -> jam mulai, sama seperti di RotasiHistory.jsx
    const byDate = {};
    (gslots || []).forEach((s) => {
      if (!byDate[s.slot_date]) byDate[s.slot_date] = [];
      byDate[s.slot_date].push(s);
    });
    const slotTimeMap = {};
    Object.entries(byDate).forEach(([date, slots]) => {
      slots.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      slots.forEach((s, idx) => {
        slotTimeMap[`${date}|${idx + 1}`] = s.start_time ? s.start_time.slice(0, 5) : null;
      });
    });

    const mapped = (data || []).map((r) => ({
      ...r,
      display_time: r.slot_number ? slotTimeMap[`${r.visit_date}|${r.slot_number}`] : null,
    }));
    setHistoryData(mapped);
    const initEditing = {};
    mapped.forEach((r) => { initEditing[r.id] = r.therapist_id || ''; });
    setHistoryEditing(initEditing);
    setHistoryLoading(false);
  };

  const saveHistory = async () => {
    setHistorySaving(true);
    const deletedIds = [];
    for (const [rowId, newTherapistId] of Object.entries(historyEditing)) {
      if (!newTherapistId) {
        await supabase.from('rotasi_schedule').delete().eq('id', rowId);
        deletedIds.push(rowId);
      } else {
        await supabase.from('rotasi_schedule').update({ therapist_id: newTherapistId }).eq('id', rowId);
      }
    }
    setHistoryData((prev) => prev.filter((r) => !deletedIds.includes(r.id)));
    setHistoryEditing((prev) => {
      const next = { ...prev };
      deletedIds.forEach((id) => delete next[id]);
      return next;
    });
    setHistorySaving(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      medical_record_number: form.medical_record_number.trim() || null,
      birth_date: form.birth_date || null,
      diagnosis: form.diagnosis.trim() || null,
      therapy_start_date: form.therapy_start_date || null,
      bpjs_number: form.bpjs_number.trim() || null,
      insurance_type_id: form.insurance_type_id || null,
      is_active: form.is_active,
    };

    if (modalMode === 'add') {
      const { data, error } = await supabase
        .from('rotasi_patients')
        .insert(payload)
        .select('id, name, is_active, birth_date, medical_record_number, bpjs_number, therapy_start_date, diagnosis, insurance_type_id, rotasi_insurance_types(name)')
        .single();
      if (!error) { setPatients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); closeModal(); }
      else window.alert('Gagal menyimpan: ' + error.message);
    } else {
      const { data, error } = await supabase
        .from('rotasi_patients')
        .update(payload)
        .eq('id', editId)
        .select('id, name, is_active, birth_date, medical_record_number, bpjs_number, therapy_start_date, diagnosis, insurance_type_id, rotasi_insurance_types(name)')
        .single();
      if (!error) {
        setPatients((prev) => prev.map((p) => (p.id === editId ? data : p)));
        closeModal();
      } else window.alert('Gagal menyimpan: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus pasien ini? Tindakan ini tidak bisa dibatalkan.')) return;
    const { error } = await supabase.from('rotasi_patients').delete().eq('id', id);
    if (!error) setPatients((prev) => prev.filter((p) => p.id !== id));
    else window.alert('Gagal menghapus: ' + error.message);
  };

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <RotasiPwaStyles />
      <div className="rotasi-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Data Pasien</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            Semua pasien yang pernah/akan ikut rotasi. Pasien baru bisa ditambahkan kapan saja.
          </p>
        </div>
        <button onClick={openAdd} style={S.btnPrimary}>+ Tambah Pasien</button>
      </div>

      <div className="rotasi-toolbar" style={{ display: 'flex', gap: 10, margin: '20px 0 12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} style={{ display: 'flex', gap: 8 }}>
          <input
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              setSearchInput(val);
              clearTimeout(searchTimeout.current);
              searchTimeout.current = setTimeout(() => {
                setSearch(val);
                setPage(1);
              }, 350);
            }}
            placeholder="Cari nama, No. RM, diagnosis..."
            style={{ ...S.inputBase, maxWidth: 300 }}
          />
          {searchInput && (
            <button type="button" onClick={() => {
              setSearch('');
              setSearchInput('');
              setPage(1);
              clearTimeout(searchTimeout.current);
            }} style={{ ...S.btnSecondary }}>✕ Reset</button>
          )}
        </form>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Baris per halaman:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ ...S.inputBase, width: 70 }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {!loading && (
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>
          Menampilkan {totalCount === 0 ? 0 : Math.min((page - 1) * pageSize + 1, totalCount)}–{Math.min(page * pageSize, totalCount)} dari <strong>{totalCount.toLocaleString('id-ID')}</strong> pasien
          {search && <span style={{ color: '#2563eb' }}> · hasil pencarian "{search}"</span>}
        </p>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Memuat...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                {SORT_COLS.map((col) => (
                  <th key={col.key} style={S.th} onClick={() => handleSort(col.key)}>
                    {col.label}{sortIcon(col.key)}
                  </th>
                ))}
                <th style={{ ...S.th, cursor: 'default' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '28px 0' }}>
                    {patients.length === 0 ? 'Belum ada data pasien.' : 'Tidak ada hasil pencarian.'}
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const age = calcAge(p.birth_date);
                  return (
                    <tr
                      key={p.id}
                      style={{ background: '#fff' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                    >
                      <td style={S.td}>
                        <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>
                          {p.medical_record_number || '-'}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {p.name}
                          <button
                            onClick={(e) => { e.stopPropagation(); openHistory(p); }}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            📋 Riwayat
                          </button>
                        </div>
                      </td>
                      <td style={S.td}>{fmtDate(p.birth_date)}</td>
                      <td style={S.td}>{age != null ? `${age} th` : '-'}</td>
                      <td style={S.td}>{p.diagnosis || '-'}</td>
                      <td style={S.td}>{fmtDate(p.therapy_start_date)}</td>
                      <td style={S.td}>{p.bpjs_number || '-'}</td>
                      <td style={S.td}>{p.rotasi_insurance_types?.name || '-'}</td>
                      <td style={S.td}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                          background: p.is_active !== false ? '#dcfce7' : '#f1f5f9',
                          color: p.is_active !== false ? '#15803d' : '#64748b',
                        }}>
                          {p.is_active !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(p)} style={S.btnEdit}>Edit</button>
                        <button onClick={() => handleDelete(p.id)} style={S.btnDelete}>Hapus</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, flexWrap: 'wrap', gap: 12 }}>
          {/* Info halaman */}
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            Halaman <strong style={{ color: '#334155' }}>{page}</strong> dari <strong style={{ color: '#334155' }}>{totalPages}</strong>
          </span>

          {/* Navigasi */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* First */}
            <button
              onClick={() => setPage(1)} disabled={page === 1}
              style={{ ...S.pagerBtn, opacity: page === 1 ? 0.4 : 1 }}
              title="Halaman pertama"
            >«</button>
            {/* Prev */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ ...S.pagerBtn, opacity: page === 1 ? 0.4 : 1 }}
              title="Sebelumnya"
            >‹</button>

            {/* Page numbers dengan ellipsis */}
            {(() => {
              const items = [];
              const delta = 2;
              const left = page - delta;
              const right = page + delta;
              let last = 0;
              for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                  if (last && i - last > 1) {
                    items.push(
                      <span key={`e${i}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: 13 }}>…</span>
                    );
                  }
                  items.push(
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      style={{
                        ...S.pagerBtn,
                        minWidth: 36,
                        background: page === i ? '#2563eb' : '#fff',
                        color: page === i ? '#fff' : '#334155',
                        border: page === i ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        fontWeight: page === i ? 700 : 500,
                        boxShadow: page === i ? '0 1px 4px rgba(37,99,235,0.25)' : 'none',
                      }}
                    >{i}</button>
                  );
                  last = i;
                }
              }
              return items;
            })()}

            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ ...S.pagerBtn, opacity: page === totalPages ? 0.4 : 1 }}
              title="Selanjutnya"
            >›</button>
            {/* Last */}
            <button
              onClick={() => setPage(totalPages)} disabled={page === totalPages}
              style={{ ...S.pagerBtn, opacity: page === totalPages ? 0.4 : 1 }}
              title="Halaman terakhir"
            >»</button>
          </div>

          {/* Jump to page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Ke halaman:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              defaultValue={page}
              key={page}
              onBlur={(e) => {
                const v = parseInt(e.target.value);
                if (v >= 1 && v <= totalPages) setPage(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt(e.target.value);
                  if (v >= 1 && v <= totalPages) setPage(v);
                }
              }}
              style={{ ...S.inputBase, width: 60, textAlign: 'center', padding: '6px 8px' }}
            />
          </div>
        </div>
      )}

      {/* ── MODAL ── */}
      {/* Modal Riwayat Terapi */}
      {historyPatient && (
        <div className="rotasi-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryPatient(null); }}>
          <div className="rotasi-modal-card" style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>Riwayat Seluruh Sesi Terapi</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}><strong>{historyPatient.name}</strong> · {historyData.length} sesi tercatat</p>

            {historyLoading ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Memuat...</p>
            ) : historyData.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada riwayat sesi terapi.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                {historyData.map((row, i) => (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: row.confirmed ? '#f8fafc' : '#fffbeb', borderRadius: 8, border: `1px solid ${row.confirmed ? '#e2e8f0' : '#fde68a'}` }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', width: 90, flexShrink: 0 }}>
                      Sesi ke-{historyData.length - i}<br />
                      <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{row.visit_date}</span>
                      {row.display_time && (
                        <><br /><span style={{ fontSize: 10 }}>{row.display_time}</span></>
                      )}
                    </span>
                    <select
                      value={historyEditing[row.id] ?? ''}
                      onChange={(e) => setHistoryEditing((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}
                    >
                      <option value="">-- Kosongkan --</option>
                      {allTherapists.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setHistoryPatient(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Tutup
              </button>
              {historyData.length > 0 && (
                <button onClick={saveHistory} disabled={historySaving}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  {historySaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="rotasi-modal-overlay" style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="rotasi-modal-card" style={S.modal}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px' }}>
              {modalMode === 'add' ? '+ Tambah Pasien' : 'Edit Pasien'}
            </h2>
            <form onSubmit={handleSave}>
              <FL label="Nama Pasien" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nama lengkap"
                  style={S.inputBase}
                  required
                />
              </FL>
              <FL label="No. RM">
                <input
                  value={form.medical_record_number}
                  onChange={(e) => setForm((f) => ({ ...f, medical_record_number: e.target.value }))}
                  placeholder="Nomor rekam medis"
                  style={S.inputBase}
                />
              </FL>
              <div className="rotasi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FL label="Tanggal Lahir">
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                    style={S.inputBase}
                  />
                </FL>
                <FL label="Tgl Awal Terapi">
                  <input
                    type="date"
                    value={form.therapy_start_date}
                    onChange={(e) => setForm((f) => ({ ...f, therapy_start_date: e.target.value }))}
                    style={S.inputBase}
                  />
                </FL>
              </div>
              <FL label="Diagnosis">
                <select
                  value={form.diagnosis}
                  onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  style={S.inputBase}
                >
                  <option value="">-- Pilih Diagnosis --</option>
                  {diagnoses.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </FL>
              <div className="rotasi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FL label="No. BPJS">
                  <input
                    value={form.bpjs_number}
                    onChange={(e) => setForm((f) => ({ ...f, bpjs_number: e.target.value }))}
                    placeholder="Nomor BPJS"
                    style={S.inputBase}
                  />
                </FL>
                <FL label="Eselon">
                  <select
                    value={form.insurance_type_id}
                    onChange={(e) => setForm((f) => ({ ...f, insurance_type_id: e.target.value }))}
                    style={S.inputBase}
                  >
                    <option value="">-- Pilih Eselon --</option>
                    {insuranceTypes.map((it) => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                </FL>
              </div>
              <FL label="Status">
                <select
                  value={form.is_active ? 'true' : 'false'}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
                  style={S.inputBase}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </FL>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={closeModal} style={S.btnSecondary}>Batal</button>
                <button type="submit" disabled={saving} style={S.btnPrimary}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotasiPatients;