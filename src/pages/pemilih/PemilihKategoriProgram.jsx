import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react';

const PemilihKategoriProgram = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNama, setNewNama] = useState('');
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase.from('pemilih_kategori_program').select('id, nama').order('nama');
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const addItem = async () => {
    if (!newNama.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('pemilih_kategori_program').insert({ nama: newNama.trim() });
    if (error) toast({ title: 'Gagal menambah', description: error.message, variant: 'destructive' });
    else { setNewNama(''); fetchAll(); }
    setSaving(false);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Hapus kategori program ini? Data pemilih yang memakai kategori ini akan otomatis dikosongkan.')) return;
    const { error } = await supabase.from('pemilih_kategori_program').delete().eq('id', id);
    if (error) toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  const startEdit = (id, value) => { setEditId(id); setEditValue(value); };

  const saveEdit = async () => {
    const { error } = await supabase.from('pemilih_kategori_program').update({ nama: editValue }).eq('id', editId);
    if (error) toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    else { setEditId(null); fetchAll(); }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="p-page-title">Setup Kategori Program</h1>
      <p className="p-page-subtitle">
        Kelola daftar Kategori Program yang muncul di dropdown form Scan/Upload KTP.
      </p>

      <div className="p-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            className="p-input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Nama kategori program baru..."
            value={newNama}
            onChange={(e) => setNewNama(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
          />
          <button className="p-btn-primary" onClick={addItem} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah
          </button>
        </div>
        {list.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada data kategori program.</p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <tbody>
                {list.map((k) => (
                  <tr key={k.id}>
                    <td>
                      {editId === k.id ? (
                        <input className="p-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                      ) : k.nama}
                    </td>
                    <td style={{ textAlign: 'right', width: 100, whiteSpace: 'nowrap' }}>
                      {editId === k.id ? (
                        <>
                          <button onClick={saveEdit} style={{ marginRight: 8, color: '#16a34a' }}><Check size={16} /></button>
                          <button onClick={() => setEditId(null)} style={{ color: '#64748b' }}><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(k.id, k.nama)} style={{ marginRight: 8, color: '#2563eb' }}><Pencil size={15} /></button>
                          <button onClick={() => deleteItem(k.id)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PemilihKategoriProgram;
