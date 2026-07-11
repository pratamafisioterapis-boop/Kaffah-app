import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import RotasiPwaStyles from './RotasiPwaStyles';

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
    padding: '8px 14px', background: '#f1f5f9', color: '#334155',
    border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460,
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

const RotasiTherapists = () => {
  const [therapists, setTherapists] = useState([]);
  const [professions, setProfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const EMPTY_FORM = { name: '', profesi: '', tanggal_bergabung: '' };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

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

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalMode('add');
    setModalOpen(true);
  };

  const openEdit = (t) => {
    setForm({
      name: t.name || '',
      profesi: t.profesi || '',
      tanggal_bergabung: t.tanggal_bergabung || '',
    });
    setEditId(t.id);
    setModalMode('edit');
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setSaving(false); };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmed = form.name.trim();
    if (!trimmed) return;
    setSaving(true);
    const payload = {
      name: trimmed,
      profesi: form.profesi.trim() || null,
      tanggal_bergabung: form.tanggal_bergabung || null,
    };

    if (modalMode === 'add') {
      const { data, error } = await supabase
        .from('rotasi_therapists')
        .insert(payload)
        .select()
        .single();
      if (!error) { setTherapists((prev) => [...prev, data]); closeModal(); }
      else window.alert('Gagal menyimpan: ' + error.message);
    } else {
      const { data, error } = await supabase
        .from('rotasi_therapists')
        .update(payload)
        .eq('id', editId)
        .select()
        .single();
      if (!error) {
        setTherapists((prev) => prev.map((th) => (th.id === editId ? data : th)));
        closeModal();
      } else window.alert('Gagal menyimpan: ' + error.message);
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
    if (!error) setTherapists((prev) => prev.map((th) => (th.id === t.id ? data : th)));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus terapis ini?')) return;
    const { error } = await supabase.from('rotasi_therapists').delete().eq('id', id);
    if (!error) setTherapists((prev) => prev.filter((t) => t.id !== id));
    else window.alert('Gagal menghapus: ' + error.message);
  };

  return (
    <div>
      <RotasiPwaStyles />
      {/* Header */}
      <div className="rotasi-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Data Terapis</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            Kelola terapis yang ikut dalam rotasi jadwal. Nonaktifkan terapis yang sedang cuti/libur.
          </p>
        </div>
        <button onClick={openAdd} style={S.btnPrimary}>+ Tambah Terapis</button>
      </div>

      {/* Count */}
      {!loading && (
        <p style={{ fontSize: 13, color: '#64748b', margin: '16px 0 12px' }}>
          {therapists.length} terapis terdaftar
        </p>
      )}

      {/* List */}
      {loading ? (
        <p style={{ color: '#94a3b8' }}>Memuat...</p>
      ) : therapists.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada terapis. Tambahkan minimal 2 terapis untuk mulai membuat jadwal.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {therapists.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 10, flexWrap: 'wrap', gap: 10,
                background: t.is_active !== false ? '#fff' : '#f8fafc',
                border: `1px solid ${t.is_active !== false ? '#e2e8f0' : '#f1f5f9'}`,
                opacity: t.is_active !== false ? 1 : 0.7,
              }}
            >
              {/* Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: '#e0e7ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 15,
                  color: '#3730a3',
                }}>
                  {(t.name || '?').charAt(0).toUpperCase()}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{t.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: t.is_active !== false ? '#dcfce7' : '#f1f5f9',
                      color: t.is_active !== false ? '#15803d' : '#64748b',
                    }}>
                      {t.is_active !== false ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {t.profesi || 'Tanpa profesi'}
                    {t.tanggal_bergabung && (
                      <span style={{ marginLeft: 8 }}>
                        · Bergabung {new Date(t.tanggal_bergabung).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => openEdit(t)}
                  style={{
                    fontSize: 12, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(t)}
                  style={{
                    fontSize: 12, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600,
                  }}
                >
                  {t.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  style={{
                    fontSize: 12, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 600,
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL Tambah / Edit ── */}
      {modalOpen && (
        <div className="rotasi-modal-overlay" style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="rotasi-modal-card" style={S.modal}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px' }}>
              {modalMode === 'add' ? '+ Tambah Terapis' : 'Edit Terapis'}
            </h2>
            <form onSubmit={handleSave}>
              <FL label="Nama Terapis" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nama lengkap terapis"
                  style={S.inputBase}
                  required
                  autoFocus
                />
              </FL>

              <FL label="Profesi">
                <select
                  value={form.profesi}
                  onChange={(e) => setForm((f) => ({ ...f, profesi: e.target.value }))}
                  style={S.inputBase}
                >
                  <option value="">-- Pilih Profesi --</option>
                  {professions.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </FL>

              <FL label="Tanggal Bergabung">
                <input
                  type="date"
                  value={form.tanggal_bergabung}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal_bergabung: e.target.value }))}
                  style={S.inputBase}
                />
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

export default RotasiTherapists;