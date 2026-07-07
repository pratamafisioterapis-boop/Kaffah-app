import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const RotasiTherapists = () => {
  const [therapists, setTherapists] = useState([]);
  const [professions, setProfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    profesi: '',
    tanggal_bergabung: '',
    level: 'junior',
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    profesi: '',
    tanggal_bergabung: '',
    level: 'junior',
  });
  const [editSaving, setEditSaving] = useState(false);

  const fetchTherapists = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_therapists')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setTherapists(data || []);
    setLoading(false);
  };

  const fetchProfessions = async () => {
    const { data, error } = await supabase
      .from('rotasi_professions')
      .select('id, name')
      .order('name', { ascending: true });
    if (!error) setProfessions(data || []);
  };

  useEffect(() => {
    fetchTherapists();
    fetchProfessions();
  }, []);

  const openAddModal = () => {
    setAddForm({ name: '', profesi: '', tanggal_bergabung: '', level: 'junior' });
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
      .from('rotasi_therapists')
      .insert({
        name: trimmed,
        profesi: addForm.profesi.trim() || null,
        tanggal_bergabung: addForm.tanggal_bergabung || null,
        level: addForm.level || 'junior',
      })
      .select()
      .single();
    if (!error) {
      setTherapists((prev) => [...prev, data]);
      setAddModalOpen(false);
    }
    setSaving(false);
  };

  const toggleActive = async (t) => {
    const { data, error } = await supabase
      .from('rotasi_therapists')
      .update({ is_active: !t.is_active })
      .eq('id', t.id)
      .select()
      .single();
    if (!error) {
      setTherapists((prev) => prev.map((th) => (th.id === t.id ? data : th)));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus terapis ini?')) return;
    const { error } = await supabase.from('rotasi_therapists').delete().eq('id', id);
    if (!error) setTherapists((prev) => prev.filter((t) => t.id !== id));
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name || '',
      profesi: t.profesi || '',
      tanggal_bergabung: t.tanggal_bergabung || '',
      level: t.level || 'junior',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
    const trimmed = editForm.name.trim();
    if (!trimmed) return;
    setEditSaving(true);
    const { data, error } = await supabase
      .from('rotasi_therapists')
      .update({
        name: trimmed,
        profesi: editForm.profesi.trim() || null,
        tanggal_bergabung: editForm.tanggal_bergabung || null,
        level: editForm.level || 'junior',
      })
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setTherapists((prev) => prev.map((th) => (th.id === id ? data : th)));
      setEditingId(null);
    } else {
      window.alert('Gagal menyimpan perubahan: ' + error.message);
    }
    setEditSaving(false);
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Data Terapis</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Kelola terapis yang ikut dalam rotasi jadwal. Nonaktifkan terapis yang sedang cuti/libur.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
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
          + Tambah Terapis
        </button>
      </div>

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
              Tambah Terapis
            </h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Nama Terapis
                </label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Profesi
                </label>
                <select
                  value={addForm.profesi}
                  onChange={(e) => setAddForm((f) => ({ ...f, profesi: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                    background: '#fff',
                  }}
                >
                  <option value="">Pilih profesi...</option>
                  {professions.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Tanggal Bergabung
                </label>
                <input
                  type="date"
                  value={addForm.tanggal_bergabung}
                  onChange={(e) => setAddForm((f) => ({ ...f, tanggal_bergabung: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Level
                </label>
                <select
                  value={addForm.level}
                  onChange={(e) => setAddForm((f) => ({ ...f, level: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="junior">Junior</option>
                  <option value="senior">Senior</option>
                </select>
              </div>

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

      {loading ? (
        <p>Memuat...</p>
      ) : therapists.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada terapis. Tambahkan minimal 2 terapis untuk mulai membuat jadwal.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {therapists.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              {editingId === t.id ? (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Nama"
                      style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                    <select
                      value={editForm.profesi}
                      onChange={(e) => setEditForm((f) => ({ ...f, profesi: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                    >
                      <option value="">Pilih profesi...</option>
                      {professions.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.level}
                      onChange={(e) => setEditForm((f) => ({ ...f, level: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      <option value="junior">Junior</option>
                      <option value="senior">Senior</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleUpdate(t.id)}
                      disabled={editSaving}
                      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#fff', color: '#15803d', cursor: 'pointer' }}
                    >
                      Simpan
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' }}
                    >
                      Batal
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: t.is_active ? '#22c55e' : '#cbd5e1',
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    {t.profesi && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>({t.profesi})</span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: t.level === 'senior' ? '#fef3c7' : '#e0e7ff',
                        color: t.level === 'senior' ? '#92400e' : '#3730a3',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t.level === 'senior' ? 'Senior' : 'Junior'}
                    </span>
                    {!t.is_active && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>(nonaktif)</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => startEdit(t)}
                      style={{
                        fontSize: 12,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #bfdbfe',
                        background: '#fff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(t)}
                      style={{
                        fontSize: 12,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      style={{
                        fontSize: 12,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fff',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RotasiTherapists;
