import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const RotasiPatients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    medical_record_number: '',
    birth_date: '',
    therapy_start_date: '',
    diagnosis: '',
    bpjs_number: '',
    insurance_type_id: '',
    is_active: true,
  });

  const [editingPatient, setEditingPatient] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    medical_record_number: '',
    birth_date: '',
    therapy_start_date: '',
    diagnosis: '',
    bpjs_number: '',
    insurance_type_id: '',
    is_active: true,
  });
  const [editSaving, setEditSaving] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [insuranceTypes, setInsuranceTypes] = useState([]);

  const fetchPatients = async () => {
    setLoading(true);
    const batchSize = 1000;
    let all = [];
    let from = 0;
    let keepGoing = true;
    while (keepGoing) {
      const { data, error } = await supabase
        .from('rotasi_patients')
        .select('*')
        .order('name', { ascending: true })
        .range(from, from + batchSize - 1);
      if (error) {
        keepGoing = false;
        break;
      }
      all = all.concat(data || []);
      if (!data || data.length < batchSize) {
        keepGoing = false;
      } else {
        from += batchSize;
      }
    }
    setPatients(all);
    setLoading(false);
  };

  const fetchInsuranceTypes = async () => {
    const { data, error } = await supabase
      .from('rotasi_insurance_types')
      .select('id, name')
      .order('name', { ascending: true });
    if (!error) setInsuranceTypes(data || []);
  };

  useEffect(() => {
    fetchPatients();
    fetchInsuranceTypes();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  const openAddModal = () => {
    setAddForm({
      name: '',
      medical_record_number: '',
      birth_date: '',
      therapy_start_date: '',
      diagnosis: '',
      bpjs_number: '',
      insurance_type_id: '',
      is_active: true,
    });
    setAddModalOpen(true);
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = addForm.name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_patients')
      .insert({
        name: trimmed,
        medical_record_number: addForm.medical_record_number.trim() || null,
        birth_date: addForm.birth_date || null,
        therapy_start_date: addForm.therapy_start_date || null,
        diagnosis: addForm.diagnosis.trim() || null,
        bpjs_number: addForm.bpjs_number.trim() || null,
        insurance_type_id: addForm.insurance_type_id || null,
        is_active: addForm.is_active,
      })
      .select()
      .single();
    if (!error) {
      setPatients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setAddModalOpen(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus pasien ini? Riwayat jadwalnya juga akan ikut terhapus.')) return;
    const { error } = await supabase.from('rotasi_patients').delete().eq('id', id);
    if (!error) setPatients((prev) => prev.filter((p) => p.id !== id));
  };

  const handleEditClick = (p) => {
    setEditingPatient(p);
    setEditForm({
      name: p.name || '',
      medical_record_number: p.medical_record_number || '',
      birth_date: p.birth_date || '',
      therapy_start_date: p.therapy_start_date || '',
      diagnosis: p.diagnosis || '',
      bpjs_number: p.bpjs_number || '',
      insurance_type_id: p.insurance_type_id || '',
      is_active: p.is_active !== false,
    });
  };

  const closeEditModal = () => {
    setEditingPatient(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const trimmed = editForm.name.trim();
    if (!trimmed) return;
    setEditSaving(true);
    const { data, error } = await supabase
      .from('rotasi_patients')
      .update({
        name: trimmed,
        medical_record_number: editForm.medical_record_number.trim() || null,
        birth_date: editForm.birth_date || null,
        therapy_start_date: editForm.therapy_start_date || null,
        diagnosis: editForm.diagnosis.trim() || null,
        bpjs_number: editForm.bpjs_number.trim() || null,
        insurance_type_id: editForm.insurance_type_id || null,
        is_active: editForm.is_active,
      })
      .eq('id', editingPatient.id)
      .select()
      .single();
    if (!error) {
      setPatients((prev) =>
        prev
          .map((p) => (p.id === data.id ? data : p))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingPatient(null);
    }
    setEditSaving(false);
  };

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const insuranceMap = useMemo(() => {
    const map = {};
    insuranceTypes.forEach((t) => {
      map[t.id] = t.name;
    });
    return map;
  }, [insuranceTypes]);

  const calculateAge = (birthDate) => {
    if (!birthDate) return '-';
    const dob = new Date(birthDate);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 1) return `${months} bln`;
    return `${years} th`;
  };

  const BULAN_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortValue = (p, key) => {
    switch (key) {
      case 'medical_record_number':
        return (p.medical_record_number || '').toLowerCase();
      case 'name':
        return (p.name || '').toLowerCase();
      case 'birth_date':
        return p.birth_date || '';
      case 'age':
        return p.birth_date || '';
      case 'diagnosis':
        return (p.diagnosis || '').toLowerCase();
      case 'therapy_start_date':
        return p.therapy_start_date || '';
      case 'bpjs_number':
        return (p.bpjs_number || '').toLowerCase();
      case 'eselon':
        return (insuranceMap[p.insurance_type_id] || '').toLowerCase();
      default:
        return '';
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    const va = getSortValue(a, sortConfig.key);
    const vb = getSortValue(b, sortConfig.key);
    if (va < vb) return sortConfig.direction === 'asc' ? -1 : 1;
    if (va > vb) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const sortArrow = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const goToPage = (page) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Data Pasien</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Semua pasien yang pernah/akan ikut rotasi. Pasien baru bisa ditambahkan kapan saja.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          type="button"
          onClick={openAddModal}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          + Tambah Pasien
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari pasien..."
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          fontSize: 13,
          marginBottom: 16,
        }}
      />

      {loading ? (
        <p>Memuat...</p>
      ) : sorted.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada pasien.</p>
      ) : (
        <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, color: '#475569' }}>
          <span>Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} dari {sorted.length} pasien</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="pageSize" style={{ fontSize: 13 }}>Baris per halaman:</label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thSortStyle} onClick={() => handleSort('medical_record_number')}>
                  No. RM{sortArrow('medical_record_number')}
                </th>
                <th style={thSortStyle} onClick={() => handleSort('name')}>
                  Nama Pasien{sortArrow('name')}
                </th>
                <th style={thSortStyle} onClick={() => handleSort('birth_date')}>
                  Tgl Lahir{sortArrow('birth_date')}
                </th>
                <th style={thSortStyle} onClick={() => handleSort('age')}>
                  Usia{sortArrow('age')}
                </th>
                <th style={thSortStyle} onClick={() => handleSort('diagnosis')}>
                  Diagnosis{sortArrow('diagnosis')}
                </th>
                <th style={thSortStyle} onClick={() => handleSort('therapy_start_date')}>
                  Tgl Awal Terapi{sortArrow('therapy_start_date')}
                </th>
                <th style={thSortStyle} onClick={() => handleSort('bpjs_number')}>
                  No. Bpjs{sortArrow('bpjs_number')}
                </th>
                <th style={thSortStyle} onClick={() => handleSort('eselon')}>
                  Eselon{sortArrow('eselon')}
                </th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{p.medical_record_number || '-'}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                  <td style={tdStyle}>{formatDate(p.birth_date)}</td>
                  <td style={tdStyle}>{calculateAge(p.birth_date)}</td>
                  <td style={tdStyle}>{p.diagnosis || '-'}</td>
                  <td style={tdStyle}>{formatDate(p.therapy_start_date)}</td>
                  <td style={tdStyle}>{p.bpjs_number || '-'}</td>
                  <td style={tdStyle}>{insuranceMap[p.insurance_type_id] || '-'}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: p.is_active !== false ? '#dcfce7' : '#f1f5f9',
                        color: p.is_active !== false ? '#15803d' : '#64748b',
                      }}
                    >
                      {p.is_active !== false ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleEditClick(p)}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #bfdbfe',
                        background: '#fff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        marginRight: 6,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fff',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => goToPage(1)}
            disabled={safePage === 1}
            style={pageBtnStyle(safePage === 1)}
          >
            «
          </button>
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 1}
            style={pageBtnStyle(safePage === 1)}
          >
            ‹ Sebelumnya
          </button>
          <span style={{ fontSize: 13, color: '#334155', padding: '0 8px' }}>
            Halaman {safePage} dari {totalPages}
          </span>
          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage === totalPages}
            style={pageBtnStyle(safePage === totalPages)}
          >
            Berikutnya ›
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={safePage === totalPages}
            style={pageBtnStyle(safePage === totalPages)}
          >
            »
          </button>
        </div>
        </>
      )}

      {addModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={closeAddModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 420,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 0, marginBottom: 16 }}>
              Tambah Pasien
            </h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>No. RM</label>
                <input
                  value={addForm.medical_record_number}
                  onChange={(e) => setAddForm((f) => ({ ...f, medical_record_number: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Nama</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tanggal Lahir</label>
                <input
                  type="date"
                  value={addForm.birth_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, birth_date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Diagnosis</label>
                <input
                  value={addForm.diagnosis}
                  onChange={(e) => setAddForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tanggal Awal Terapi</label>
                <input
                  type="date"
                  value={addForm.therapy_start_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, therapy_start_date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>No. Bpjs</label>
                <input
                  value={addForm.bpjs_number}
                  onChange={(e) => setAddForm((f) => ({ ...f, bpjs_number: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Eselon</label>
                <select
                  value={addForm.insurance_type_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, insurance_type_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">-- Pilih Eselon --</option>
                  {insuranceTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={addForm.is_active}
                  onChange={(e) => setAddForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Aktif
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={closeAddModal}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPatient && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={closeEditModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 420,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 0, marginBottom: 16 }}>
              Edit Pasien
            </h2>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>No. RM</label>
                <input
                  value={editForm.medical_record_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, medical_record_number: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Nama</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tanggal Lahir</label>
                <input
                  type="date"
                  value={editForm.birth_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, birth_date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Diagnosis</label>
                <input
                  value={editForm.diagnosis}
                  onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tanggal Awal Terapi</label>
                <input
                  type="date"
                  value={editForm.therapy_start_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, therapy_start_date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>No. Bpjs</label>
                <input
                  value={editForm.bpjs_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, bpjs_number: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Eselon</label>
                <select
                  value={editForm.insurance_type_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, insurance_type_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">-- Pilih Eselon --</option>
                  {insuranceTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Aktif
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={closeEditModal}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {editSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const pageBtnStyle = (disabled) => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: disabled ? '#f1f5f9' : '#fff',
  color: disabled ? '#94a3b8' : '#334155',
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const thStyle = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
};

const thSortStyle = {
  ...thStyle,
  cursor: 'pointer',
  userSelect: 'none',
};

const tdStyle = {
  padding: '10px 14px',
  color: '#334155',
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 4,
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box',
};

export default RotasiPatients;