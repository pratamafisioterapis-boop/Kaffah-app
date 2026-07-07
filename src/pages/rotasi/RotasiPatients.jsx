import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

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

  // ─── fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => { fetchInsuranceTypes(); }, []);
  useEffect(() => { fetchPatients(); }, [page, pageSize, sortKey, sortDir, search]);

  const fetchInsuranceTypes = async () => {
    const { data } = await supabase.from('rotasi_insurance_types').select('id, name').order('name', { ascending: true });
    if (data) setInsuranceTypes(data);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Data Pasien</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            Semua pasien yang pernah/akan ikut rotasi. Pasien baru bisa ditambahkan kapan saja.
          </p>
        </div>
        <button onClick={openAdd} style={S.btnPrimary}>+ Tambah Pasien</button>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '20px 0 12px', alignItems: 'center' }}>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} style={{ display: 'flex', gap: 8 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama, No. RM, diagnosis..."
            style={{ ...S.inputBase, maxWidth: 300 }}
          />
          <button type="submit" style={{ ...S.btnPrimary, padding: '9px 14px', background: '#475569' }}>Cari</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} style={{ ...S.btnSecondary }}>✕ Reset</button>
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
                      <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
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
      {modalOpen && (
        <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={S.modal}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                <input
                  value={form.diagnosis}
                  onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  placeholder="Contoh: F80.1 - GBE"
                  style={S.inputBase}
                />
              </FL>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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