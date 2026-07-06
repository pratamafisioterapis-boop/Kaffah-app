import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const RotasiPatients = () => {
  const [patients, setPatients] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 8,
          }}
        >
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RotasiPatients;