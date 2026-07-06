import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const RotasiTherapists = () => {
  const [therapists, setTherapists] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTherapists = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_therapists')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setTherapists(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTherapists();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_therapists')
      .insert({ name: trimmed })
      .select()
      .single();
    if (!error) {
      setTherapists((prev) => [...prev, data]);
      setName('');
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

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Data Terapis</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Kelola terapis yang ikut dalam rotasi jadwal. Nonaktifkan terapis yang sedang cuti/libur.
      </p>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama terapis baru..."
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
              }}
            >
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
                {!t.is_active && (
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>(nonaktif)</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RotasiTherapists;