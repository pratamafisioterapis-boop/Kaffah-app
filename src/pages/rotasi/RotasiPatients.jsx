import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const RotasiPatients = () => {
  const [patients, setPatients] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [editingPatient, setEditingPatient] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    medical_record_number: '',
    birth_date: '',
    diagnosis: '',
    is_active: true,
  });
  const [editSaving, setEditSaving] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_patients')
      .select('*')
      .order('name', { ascending: true });
    if (!error) setPatients(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_patients')
      .insert({ name: trimmed })
      .select()
      .single();
    if (!error) {
      setPatients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
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
      diagnosis: p.diagnosis || '',
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
        diagnosis: editForm.diagnosis.trim() || null,
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

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Data Pasien</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Semua pasien yang pernah/akan ikut rotasi. Pasien baru bisa ditambahkan kapan saja.
      </p>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama pasien baru..."
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={saving}
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
          Tambah
        </button>
      </form>

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
      ) : filtered.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada pasien.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>Nama</th>
                <th style={thStyle}>No. RM</th>
                <th style={thStyle}>Tgl Lahir</th>
                <th style={thStyle}>Diagnosis</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                  <td style={tdStyle}>{p.medical_record_number || '-'}</td>
                  <td style={tdStyle}>{p.birth_date || '-'}</td>
                  <td style={tdStyle}>{p.diagnosis || '-'}</td>
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
                <label style={labelStyle}>Nama</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>No. RM</label>
                <input
                  value={editForm.medical_record_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, medical_record_number: e.target.value }))}
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

const thStyle = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
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