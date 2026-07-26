import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, KeyRound, Eye, EyeOff, UserCheck, UserX } from 'lucide-react';

const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5 };

const emptyForm = { nama: '', no_hp: '', alamat: '', username: '', password: '' };

const PemilihRelawanAkun = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pemilih_relawan')
      .select('id, nama, no_hp, alamat, username, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Gagal memuat akun relawan', description: error.message, variant: 'destructive' });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async () => {
    if (!form.nama.trim() || !form.username.trim() || !form.password.trim()) {
      toast({ title: 'Nama, username, dan password wajib diisi', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('pemilih_create_relawan_account', {
      p_username: form.username.trim(),
      p_password: form.password,
      p_nama: form.nama.trim(),
      p_no_hp: form.no_hp || null,
      p_alamat: form.alamat || null,
    });
    if (error) {
      toast({ title: 'Gagal menambah akun', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Akun relawan dibuat' });
      setForm(emptyForm);
      fetchAll();
    }
    setSaving(false);
  };

  const handleToggleActive = async (row) => {
    const { error } = await supabase
      .from('pemilih_relawan')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) toast({ title: 'Gagal mengubah status', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Hapus akun relawan "${row.nama}"? Login akun ini akan dinonaktifkan permanen.`)) return;
    const { error } = await supabase.rpc('pemilih_delete_relawan_account', { p_relawan_id: row.id });
    if (error) toast({ title: 'Gagal menghapus akun', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Akun relawan dihapus' });
      fetchAll();
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword.trim() || resetPassword.length < 6) {
      toast({ title: 'Password minimal 6 karakter', variant: 'destructive' });
      return;
    }
    setResetSaving(true);
    const { error } = await supabase.rpc('pemilih_reset_relawan_password', {
      p_relawan_id: resetTarget.id,
      p_password: resetPassword,
    });
    if (error) {
      toast({ title: 'Gagal reset password', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Password "${resetTarget.nama}" berhasil direset` });
      setResetTarget(null);
      setResetPassword('');
    }
    setResetSaving(false);
  };

  return (
    <div>
      <h1 className="p-page-title">Akun Relawan</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Buat akun login untuk relawan. Relawan hanya bisa login ke PWA khusus untuk input data KTP.
      </p>

      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <input style={inputStyle} placeholder="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          <input style={inputStyle} placeholder="No. HP" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
          <input style={inputStyle} placeholder="Alamat" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
          <input
            style={inputStyle}
            placeholder="Username (huruf kecil/angka)"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') })}
          />
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, width: '100%', paddingRight: 34 }}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min. 6 karakter)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <button className="p-btn-primary" style={{ marginTop: 14 }} onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Akun Relawan
        </button>
      </div>

      <div className="p-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Belum ada akun relawan.</p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Alamat</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.nama}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11.5 }}>{r.no_hp || '-'}</div>
                    </td>
                    <td style={{ color: '#475569', fontFamily: 'monospace' }}>{r.username}</td>
                    <td style={{ color: '#475569' }}>{r.alamat || '-'}</td>
                    <td>
                      <span
                        className="p-badge"
                        style={{
                          background: r.is_active ? '#ecfdf5' : '#f4f5f7',
                          color: r.is_active ? '#059669' : '#6b7280',
                        }}
                      >
                        {r.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        title={r.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        onClick={() => handleToggleActive(r)}
                        style={{ color: r.is_active ? '#d97706' : '#059669', marginRight: 10 }}
                      >
                        {r.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                      <button title="Reset Password" onClick={() => { setResetTarget(r); setResetPassword(''); }} style={{ color: '#2563eb', marginRight: 10 }}>
                        <KeyRound size={15} />
                      </button>
                      <button title="Hapus" onClick={() => handleDelete(r)} style={{ color: '#dc2626' }}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resetTarget && (
        <div className="p-modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="p-modal" style={{ width: 380, maxWidth: '92vw', padding: 22 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15 }}>Reset Password</h3>
            <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 13 }}>
              Untuk akun relawan <b>{resetTarget.nama}</b> (@{resetTarget.username})
            </p>
            <input
              className="p-input"
              type="text"
              placeholder="Password baru (min. 6 karakter)"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="p-btn-ghost" onClick={() => setResetTarget(null)}>Batal</button>
              <button className="p-btn-primary" onClick={handleResetPassword} disabled={resetSaving}>
                {resetSaving ? <Loader2 className="animate-spin" size={16} /> : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PemilihRelawanAkun;
