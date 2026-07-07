import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const RotasiPatients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', diagnosa: '', profesi: '', insurance_type_id: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', diagnosa: '', profesi: '', insurance_type_id: '', notes: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [insuranceTypes, setInsuranceTypes] = useState([]);

  useEffect(() => {
    fetchPatients();
    fetchInsuranceTypes();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_patients')
      .select('*, rotasi_insurance_types(name)')
      .order('name', { ascending: true });
    if (!error) setPatients(data || []);
    setLoading(false);
  };

  const fetchInsuranceTypes = async () => {
    const { data } = await supabase
      .from('rotasi_insurance_types')
      .select('id, name')
      .order('name', { ascending: true });
    if (data) setInsuranceTypes(data);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = addForm.name.trim();
    if (!trimmed) return;
    setAddSaving(true);
    const { data, error } = await supabase
      .from('rotasi_patients')
      .insert({
        name: trimmed,
        diagnosa: addForm.diagnosa.trim() || null,
        profesi: addForm.profesi.trim() || null,
        insurance_type_id: addForm.insurance_type_id || null,
        notes: addForm.notes.trim() || null,
      })
      .select('*, rotasi_insurance_types(name)')
      .single();
    if (!error) {
      setPatients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setAddForm({ name: '', diagnosa: '', profesi: '', insurance_type_id: '', notes: '' });
    } else {
      window.alert('Gagal menambah pasien: ' + error.message);
    }
    setAddSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus pasien ini?')) return;
    const { error } = await supabase.from('rotasi_patients').delete().eq('id', id);
    if (!error) setPatients((prev) => prev.filter((p) => p.id !== id));
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name || '',
      diagnosa: p.diagnosa || '',
      profesi: p.profesi || '',
      insurance_type_id: p.insurance_type_id || '',
      notes: p.notes || '',
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleUpdate = async (id) => {
    const trimmed = editForm.name.trim();
    if (!trimmed) return;
    setEditSaving(true);
    const { data, error } = await supabase
      .from('rotasi_patients')
      .update({
        name: trimmed,
        diagnosa: editForm.diagnosa.trim() || null,
        profesi: editForm.profesi.trim() || null,
        insurance_type_id: editForm.insurance_type_id || null,
        notes: editForm.notes.trim() || null,
      })
      .eq('id', id)
      .select('*, rotasi_insurance_types(name)')
      .single();
    if (!error) {
      setPatients((prev) => prev.map((p) => (p.id === id ? data : p)));
      setEditingId(null);
    } else {
      window.alert('Gagal menyimpan perubahan: ' + error.message);
    }
    setEditSaving(false);
  };

  const filtered = patients.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Data Pasien</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Kelola daftar pasien yang ikut dalam rotasi jadwal terapi.
      </p>

      {/* Form Tambah */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={addForm.name}
          onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nama pasien baru..."
          style={inputStyle}
          required
        />
        <input
          value={addForm.diagnosa}
          onChange={(e) => setAddForm((f) => ({ ...f, diagnosa: e.target.value }))}
          placeholder="Diagnosa (opsional)"
          style={{ ...inputStyle, maxWidth: 180 }}
        />
        <input
          value={addForm.profesi}
          onChange={(e) => setAddForm((f) => ({ ...f, profesi: e.target.value }))}
          placeholder="Profesi (opsional)"
          style={{ ...inputStyle, maxWidth: 150 }}
        />
        <select
          value={addForm.insurance_type_id}
          onChange={(e) => setAddForm((f) => ({ ...f, insurance_type_id: e.target.value }))}
          style={{ ...inputStyle, maxWidth: 160 }}
        >
          <option value="">-- Eselon --</option>
          {insuranceTypes.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
        <button type="submit" disabled={addSaving} style={btnPrimaryStyle}>
          {addSaving ? 'Menyimpan...' : 'Tambah'}
        </button>
      </form>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari pasien..."
        style={{ ...inputStyle, marginBottom: 16, maxWidth: 300 }}
      />

      {loading ? (
        <p>Memuat...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>
          {patients.length === 0 ? 'Belum ada data pasien.' : 'Tidak ada hasil pencarian.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>Nama Pasien</th>
                <th style={thStyle}>Diagnosa</th>
                <th style={thStyle}>Profesi</th>
                <th style={thStyle}>Eselon</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  {editingId === p.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          value={editForm.diagnosa}
                          onChange={(e) => setEditForm((f) => ({ ...f, diagnosa: e.target.value }))}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          value={editForm.profesi}
                          onChange={(e) => setEditForm((f) => ({ ...f, profesi: e.target.value }))}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={editForm.insurance_type_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, insurance_type_id: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">-- Eselon --</option>
                          {insuranceTypes.map((it) => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleUpdate(p.id)} disabled={editSaving} style={btnPrimaryStyle}>
                          {editSaving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button onClick={cancelEdit} style={btnEditStyle}>Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                      <td style={tdStyle}>{p.diagnosa || '-'}</td>
                      <td style={tdStyle}>{p.profesi || '-'}</td>
                      <td style={tdStyle}>{p.rotasi_insurance_types?.name || '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(p)} style={btnEditStyle}>Edit</button>
                        <button onClick={() => handleDelete(p.id)} style={btnDeleteStyle}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  padding: '8px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  flex: 1,
  minWidth: 140,
};

const btnPrimaryStyle = {
  padding: '8px 16px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const btnEditStyle = {
  padding: '5px 12px',
  background: '#f1f5f9',
  color: '#334155',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  marginRight: 4,
};

const btnDeleteStyle = {
  padding: '5px 12px',
  background: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 700,
  color: '#64748b',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle = {
  padding: '10px 14px',
  color: '#1e293b',
};

export default RotasiPatients;