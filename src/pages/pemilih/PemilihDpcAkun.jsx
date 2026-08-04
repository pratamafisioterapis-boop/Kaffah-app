import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import PemilihSelect from './PemilihSelect';
import { Loader2, Plus, Trash2, KeyRound, Eye, EyeOff, UserCheck, UserX } from 'lucide-react';

const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5 };

const emptyForm = { nama: '', no_hp: '', kecamatan_id: '', username: '', password: '' };

// Default username/password dari nama depan, mis. "Umi Sari" -> "umi@dpc.com" / "umi123".
const deriveFirstName = (nama) => (nama || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
const deriveDefaults = (nama) => {
  const first = deriveFirstName(nama);
  if (!first) return { username: '', password: '' };
  return { username: `${first}@dpc.com`, password: `${first}123`.padEnd(6, '0') };
};

const PemilihDpcAkun = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [dapilList, setDapilList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data, error }, { data: kec }] = await Promise.all([
      supabase
        .from('pemilih_dpc')
        .select('id, nama, no_hp, username, is_active, kecamatan_id, created_at, pemilih_kecamatan(nama)')
        .order('created_at', { ascending: false }),
      supabase.from('pemilih_kecamatan').select('id, nama').order('nama'),
    ]);
    if (error) toast({ title: 'Gagal memuat akun DPC', description: error.message, variant: 'destructive' });
    setRows(data || []);
    setDapilList(kec || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async () => {
    if (!form.nama.trim() || !form.username.trim() || !form.password.trim()) {
      toast({ title: 'Nama, username, dan password wajib diisi', variant: 'destructive' });
      return;
    }
    if (!form.kecamatan_id) {
      toast({ title: 'Pilih dapil/kecamatan untuk akun ini', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('pemilih_create_dpc_account', {
      p_username: form.username.trim(),
      p_password: form.password,
      p_nama: form.nama.trim(),
      p_kecamatan_id: form.kecamatan_id,
      p_no_hp: form.no_hp || null,
    });
    if (error) {
      toast({ title: 'Gagal menambah akun', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Akun DPC dibuat' });
      setForm(emptyForm);
      fetchAll();
    }
    setSaving(false);
  };

  const handleToggleActive = async (row) => {
    const { error } = await supabase
      .from('pemilih_dpc')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) toast({ title: 'Gagal mengubah status', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Hapus akun DPC "${row.nama}"? Login akun ini akan dinonaktifkan permanen. Data dapil yang sudah diinput tidak ikut terhapus.`)) return;
    const { error } = await supabase.rpc('pemilih_delete_dpc_account', { p_dpc_id: row.id });
    if (error) toast({ title: 'Gagal menghapus akun', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Akun DPC dihapus' });
      fetchAll();
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword.trim() || resetPassword.length < 6) {
      toast({ title: 'Password minimal 6 karakter', variant: 'destructive' });
      return;
    }
    setResetSaving(true);
    const { error } = await supabase.rpc('pemilih_reset_dpc_password', {
      p_dpc_id: resetTarget.id,
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
      <h1 className="p-page-title">Akun DPC</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Buat akun login untuk pengurus DPC per dapil. Akun ini hanya bisa mengatur kelurahan, jumlah TPS, dan daftar caleg
        untuk dapilnya sendiri di modul Suara PKS, serta mengisi/mengoreksi/menghapus nilai suara per TPS — tanpa akses ke dashboard/grafik.
      </p>

      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <input
            style={inputStyle}
            placeholder="Nama"
            value={form.nama}
            onChange={(e) => {
              const nama = e.target.value;
              setForm((prev) => ({ ...prev, nama, ...deriveDefaults(nama) }));
            }}
          />
          <input style={inputStyle} placeholder="No. HP" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
          <PemilihSelect
            value={form.kecamatan_id}
            onChange={(v) => setForm({ ...form, kecamatan_id: v })}
            options={dapilList.map((d) => ({ value: d.id, label: d.nama }))}
            placeholder="Pilih Dapil/Kecamatan"
            title="Dapil/Kecamatan untuk akun ini"
          />
          <input
            style={inputStyle}
            placeholder="Username, atau email lengkap"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._@-]/g, '') })}
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
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
          Username & password otomatis mengikuti nama depan selama diketik (mis. "Umi Sari" → username <code>umi@dpc.com</code>, password <code>umi123</code>). Kalau diedit manual, isikan Nama dulu sampai selesai baru sesuaikan username/password — karena mengubah Nama lagi akan menimpanya ulang.
        </p>
        <button className="p-btn-primary" style={{ marginTop: 14 }} onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Akun DPC
        </button>
      </div>

      <div className="p-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Belum ada akun DPC.</p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Dapil/Kecamatan</th>
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
                    <td style={{ color: '#475569' }}>{r.pemilih_kecamatan?.nama || '-'}</td>
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
              Untuk akun DPC <b>{resetTarget.nama}</b> (@{resetTarget.username})
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

export default PemilihDpcAkun;
