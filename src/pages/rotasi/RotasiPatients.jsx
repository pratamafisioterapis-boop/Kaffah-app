import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// ── helpers ──────────────────────────────────────────────────────────────────
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

const SORT_COLS = [
  { key: 'rm_number',       label: 'No. RM' },
  { key: 'name',            label: 'Nama Pasien' },
  { key: 'birth_date',      label: 'Tgl Lahir' },
  { key: 'age',             label: 'Usia' },
  { key: 'diagnosis',       label: 'Diagnosis' },
  { key: 'tgl_awal_terapi', label: 'Tgl Awal Terapi' },
  { key: 'no_bpjs',         label: 'No. Bpjs' },
  { key: 'insurance',       label: 'Eselon' },
  { key: 'is_active',       label: 'Status' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ── styles ────────────────────────────────────────────────────────────────────
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

// ── field label helper ────────────────────────────────────────────────────────
const FL = ({ label, required, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
      {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
    </label>
    {children}
  </div>
);

// ── main component ────────────────────────────────────────────────────────────
const RotasiPatients = () => {
  const [patients, setPatients] = useState([]);
  const [insuranceTypes, setInsuranceTypes] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);

  // table state
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [saving, setSaving] = useState(false);
  const EMPTY_FORM = {
    rm_number: '', name: '', birth_date: '', diagnosis: '',
    tgl_awal_terapi: '', no_bpjs: '', insurance_type_id: '', is_active: true,
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, iRes, dRes] = await Promise.all([
      supabase.from('rotasi_patients').select('*, rotasi_insurance_types(name)').order('name'),
      supabase.from('rotasi_insurance_types').select('id, name').order('name'),
      supabase.from('rotasi_diagnoses').select('id, name').order('name'),
    ]);
    if (!pRes.error) setPatients(pRes.data || []);
    if (!iRes.error) setInsuranceTypes(iRes.data || []);
    if (!dRes.error) setDiagnoses(dRes.data || []);
    setLoading(false);
  };

  // ── sort + filter + paginate ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) =>
      !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.rm_number || '').toLowerCase().includes(q) ||
      (p.diagnosis || '').toLowerCase().includes(q)
    );
  }, [patients, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va, vb;
      if (sortKey === 'age') {
        va = calcAge(a.birth_date) ?? -1;
        vb = calcAge(b.birth_date) ?? -1;
      } else if (sortKey === 'insurance') {
        va = a.rotasi_insurance_types?.name || '';
        vb = b.rotasi_insurance_types?.name || '';
      } else if (sortKey === 'is_active') {
        va = a.is_active ? 1 : 0;
        vb = b.is_active ? 1 : 0;
      } else {
        va = (a[sortKey] || '').toString().toLowerCase();
        vb = (b[sortKey] || '').toString().toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const sortIcon = (key) => {
    if (sortKey !== key) return <span style={{ opacity: 0.3, marginLeft: 3 }}>⇅</span>;
    return <span style={{ marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── modal helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalMode('add');
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      rm_number: p.rm_number || '',
      name: p.name || '',
      birth_date: p.birth_date || '',
      diagnosis: p.diagnosis || '',
      tgl_awal_terapi: p.tgl_awal_terapi || '',
      no_bpjs: p.no_bpjs || '',
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
      rm_number: form.rm_number.trim() || null,
      birth_date: form.birth_date || null,
      diagnosis: form.diagnosis.trim() || null,
      tgl_awal_terapi: form.tgl_awal_terapi || null,
      no_bpjs: form.no_bpjs.trim() || null,
      insurance_type_id: form.insurance_type_id || null,
      is_active: form.is_active,
    };

    if (modalMode === 'add') {
      const { data, error } = await supabase
        .from('rotasi_patients')
        .insert(payload)
        .select('*, rotasi_insurance_types(name)')
        .single();
      if (!error) { setPatients((prev) => [...prev, data]); closeModal(); }
      else window.alert('Gagal menyimpan: ' + error.message);
    } else {
      const { data, error } = await supabase
        .from('rotasi_patients')
        .update(payload)
        .eq('id', editId)
        .select('*, rotasi_insurance_types(name)')
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

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Data Pasien</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            Semua pasien yang pernah/akan ikut rotasi. Pasien baru bisa ditambahkan kapan saja.
          </p>
        </div>
        <button onClick={openAdd} style={S.btnPrimary}>+ Tambah Pasien</button>
      </div>

      {/* search + page size */}
      <div style={{ display: 'flex', gap: 10, margin: '20px 0 12px', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Cari pasien..."
          style={{ ...S.inputBase, maxWidth: 340 }}
        />
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

      {/* count */}
      {!loading && (
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>
          Menampilkan {Math.min((page - 1) * pageSize + 1, sorted.length)}–{Math.min(page * pageSize, sorted.length)} dari {sorted.length} pasien
        </p>
      )}

      {/* table */}
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
                    <tr key={p.id} style={{ background: '#fff' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={S.td}><span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>{p.rm_number || '-'}</span></td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{p.name}</td>
                      <td style={S.td}>{fmtDate(p.birth_date)}</td>
                      <td style={S.td}>{age != null ? `${age} th` : '-'}</td>
                      <td style={S.td}>{p.diagnosis || '-'}</td>
                      <td style={S.td}>{fmtDate(p.tgl_awal_terapi)}</td>
                      <td style={S.td}>{p.no_bpjs || '-'}</td>
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

      {/* pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={S.btnSecondary}>«</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={S.btnSecondary}>‹</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const pg = Math.max(1, Math.min(totalPages - 6, page - 3)) + i;
            return pg <= totalPages ? (
              <button key={pg} onClick={() => setPage(pg)} style={{
                ...S.btnSecondary,
                background: page === pg ? '#2563eb' : '#f1f5f9',
                color: page === pg ? '#fff' : '#334155',
                border: page === pg ? '1px solid #2563eb' : '1px solid #e2e8f0',
              }}>{pg}</button>
            ) : null;
          })}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.btnSecondary}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={S.btnSecondary}>»</button>
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
                  value={form.rm_number}
                  onChange={(e) => setForm((f) => ({ ...f, rm_number: e.target.value }))}
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
                    value={form.tgl_awal_terapi}
                    onChange={(e) => setForm((f) => ({ ...f, tgl_awal_terapi: e.target.value }))}
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
                  list="diag-list"
                />
                <datalist id="diag-list">
                  {diagnoses.map((d) => <option key={d.id} value={d.name} />)}
                </datalist>
              </FL>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FL label="No. BPJS">
                  <input
                    value={form.no_bpjs}
                    onChange={(e) => setForm((f) => ({ ...f, no_bpjs: e.target.value }))}
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