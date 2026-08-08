import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, Check, ShieldAlert, CreditCard, ImagePlus, Camera, FolderOpen, LogOut } from 'lucide-react';

const DAPIL_KECAMATAN = 'Balikpapan Utara';

const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const CSS = `
  :root { --r-red: #dc2626; --r-border: #e8e9ec; --r-text: #1a1d29; }
  *, *::before, *::after { box-sizing: border-box; }
  .r-wrapper {
    min-height: 100vh; min-height: 100dvh; background: #f4f5f7; color: var(--r-text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }
  .r-topbar {
    position: sticky; top: 0; z-index: 20; background: linear-gradient(165deg, #17181f 0%, #0d0e13 100%);
    padding: 16px 18px; padding-top: calc(16px + env(safe-area-inset-top, 0));
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .r-brand { display: flex; align-items: center; gap: 10px; }
  .r-brand-icon {
    width: 36px; height: 36px; border-radius: 11px; background: linear-gradient(135deg, #ef4444, #b91c1c);
    display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0;
  }
  .r-brand-text { font-weight: 800; font-size: 13.5px; color: #fff; line-height: 1.3; }
  .r-brand-sub { font-size: 10.5px; color: #a1a1aa; margin-top: 1px; }
  .r-logout {
    width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(248,113,113,0.25);
    background: rgba(248,113,113,0.08); color: #f87171; display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .r-main { max-width: 640px; margin: 0 auto; padding: 22px 16px 48px; }
  .r-card { background: #fff; border-radius: 16px; border: 1px solid var(--r-border); box-shadow: 0 4px 12px rgba(16,24,40,0.06); }
  .r-page-title { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
  .r-page-subtitle { color: #6b7280; margin: 0 0 16px; font-size: 13.5px; }
  .r-input, .r-select {
    width: 100%; padding: 10px 13px; border-radius: 11px; border: 1.5px solid var(--r-border);
    font-size: 13.5px; color: var(--r-text); background: #fff; font-family: inherit;
  }
  .r-input:focus, .r-select:focus { outline: none; border-color: #dc2626; box-shadow: 0 0 0 3.5px rgba(220,38,38,0.1); }
  .r-input:disabled { background: #f4f5f7; color: #9ca3af; }
  .r-label { font-size: 12px; font-weight: 600; color: #4b5563; margin-bottom: 5px; display: block; }
  .r-btn-primary {
    padding: 11px 20px; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border: none;
    border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 13.5px;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px; width: 100%;
  }
  .r-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
  .r-btn-ghost {
    padding: 9px 12px; background: #fff; color: var(--r-text); border: 1px solid var(--r-border);
    border-radius: 11px; cursor: pointer; font-weight: 600; font-size: 12.5px;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 1;
  }
  .r-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 480px) { .r-grid { grid-template-columns: 1fr; } }
`;

const emptyForm = {
  nama: '', nik: '', jenis_kelamin: '', tempat_lahir: '', tanggal_lahir: '',
  alamat: '', rt: '', rw: '', kelurahan_id: '', no_hp: '',
  agama: '', status_perkawinan: '', pekerjaan: '',
};

const RelawanUploadKTP = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [relawanNama, setRelawanNama] = useState('');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dapilKecamatanId, setDapilKecamatanId] = useState(null);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [rejected, setRejected] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const setup = async () => {
      const { data: relawan } = await supabase
        .from('pemilih_relawan')
        .select('nama')
        .eq('user_id', user.id)
        .maybeSingle();
      if (relawan) setRelawanNama(relawan.nama);

      const { data: kec } = await supabase
        .from('pemilih_kecamatan')
        .select('id')
        .ilike('nama', DAPIL_KECAMATAN)
        .maybeSingle();

      if (kec) {
        setDapilKecamatanId(kec.id);
        const { data: kel } = await supabase
          .from('pemilih_kelurahan')
          .select('id, nama')
          .eq('kecamatan_id', kec.id)
          .order('nama');
        setKelurahanList(kel || []);
      }
    };
    setup();
  }, [user.id]);

  const resetAll = () => {
    setFile(null);
    setPreview(null);
    setRejected(null);
    setForm(emptyForm);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRejected(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const runOcr = async () => {
    if (!file) return;
    setOcrLoading(true);
    setRejected(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('pemilih-ocr-ktp', {
        body: { image_base64: base64, media_type: file.type || 'image/jpeg' },
      });

      if (error) {
        let detail = error.message;
        try {
          const body = await error.context.json();
          detail = body?.error || detail;
        } catch (_e) { /* pakai pesan default */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      const r = data.data || {};

      const kecamatanTerbaca = normalize(r.kecamatan);
      const isDapil = kecamatanTerbaca && kecamatanTerbaca.includes('balikpapan utara');

      if (!isDapil) {
        setRejected({ kecamatanTerbaca: r.kecamatan || 'tidak terbaca' });
        setFile(null);
        setPreview(null);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (fileInputRef.current) fileInputRef.current.value = '';
        toast({
          title: 'KTP Ditolak',
          description: `Wilayah pada KTP ini adalah "${r.kecamatan || 'tidak terbaca'}", bukan Kecamatan Balikpapan Utara.`,
          variant: 'destructive',
        });
        return;
      }

      const matchedKelurahan = kelurahanList.find((k) => normalize(k.nama) === normalize(r.kelurahan));

      setForm((prev) => ({
        ...prev,
        nama: r.nama || '',
        nik: r.nik || '',
        jenis_kelamin: r.jenis_kelamin || '',
        tempat_lahir: r.tempat_lahir || '',
        tanggal_lahir: r.tanggal_lahir || '',
        alamat: r.alamat || '',
        rt: r.rt || '',
        rw: r.rw || '',
        kelurahan_id: matchedKelurahan?.id || '',
        agama: r.agama || '',
        status_perkawinan: r.status_perkawinan || '',
        pekerjaan: r.pekerjaan || '',
      }));

      if (!matchedKelurahan) {
        toast({
          title: 'Kecamatan sesuai dapil ✓',
          description: `Kelurahan "${r.kelurahan || '-'}" tidak otomatis cocok, silakan pilih manual di dropdown.`,
        });
      } else {
        toast({ title: 'Berhasil membaca KTP', description: 'Silakan periksa & lengkapi data sebelum disimpan.' });
      }
    } catch (err) {
      toast({ title: 'Gagal membaca KTP', description: err.message, variant: 'destructive' });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.nama) {
      toast({ title: 'Nama wajib diisi', variant: 'destructive' });
      return;
    }
    if (!form.no_hp || !form.no_hp.trim()) {
      toast({ title: 'No. HP belum diisi', description: 'Nomor HP wajib diisi sebelum menyimpan data pemilih.', variant: 'destructive' });
      return;
    }
    if (!dapilKecamatanId) {
      toast({ title: 'Data kecamatan dapil belum siap, coba muat ulang halaman', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Cek duplikat: NIK sama, atau nama+tanggal lahir sama (kemungkinan NIK salah baca OCR).
      const { data: dupe, error: dupeError } = await supabase.rpc('pemilih_check_duplicate', {
        p_nik: form.nik || null,
        p_nama: form.nama,
        p_tanggal_lahir: form.tanggal_lahir || null,
      });
      if (dupeError) throw new Error(`Gagal cek duplikat: ${dupeError.message}`);
      if (dupe && dupe.length > 0) {
        const { match_type, petugas_nama } = dupe[0];
        const dupeErr = new Error(
          match_type === 'nik'
            ? `Data dengan NIK ini sudah diinput oleh ${petugas_nama}.`
            : `Data dengan nama & tanggal lahir yang sama sudah diinput oleh ${petugas_nama} (kemungkinan NIK salah terbaca saat scan).`
        );
        dupeErr.isDuplicate = true;
        throw dupeErr;
      }

      let fotoPath = null;
      if (file) {
        const safeName = (form.nik || form.nama || 'ktp').replace(/[^a-zA-Z0-9-_]/g, '_');
        const ext = file.name.split('.').pop() || 'jpg';
        fotoPath = `${user.id}/${safeName}_${Date.now()}.${ext}`;

        const { error: upErr } = await supabase.storage.from('pemilih-ktp').upload(fotoPath, file);
        if (upErr) throw new Error(`Gagal upload foto KTP: ${upErr.message}`);
      }

      const { error } = await supabase.from('pemilih_data').insert({
        nama: form.nama,
        nik: form.nik || null,
        jenis_kelamin: form.jenis_kelamin || null,
        tempat_lahir: form.tempat_lahir || null,
        tanggal_lahir: form.tanggal_lahir || null,
        alamat: form.alamat || null,
        rt: form.rt || null,
        rw: form.rw || null,
        no_hp: form.no_hp || null,
        kecamatan_id: dapilKecamatanId,
        kelurahan_id: form.kelurahan_id || null,
        agama: form.agama || null,
        status_perkawinan: form.status_perkawinan || null,
        pekerjaan: form.pekerjaan || null,
        foto_ktp_path: fotoPath,
        sumber_data: 'relawan',
        petugas_input: user.id,
      });
      if (error) throw error;

      toast({ title: 'Data pemilih tersimpan' });
      resetAll();
    } catch (err) {
      toast({ title: err.isDuplicate ? 'Data Sudah Ada' : 'Gagal menyimpan', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="r-wrapper">
        <div className="r-topbar">
          <div className="r-brand">
            <div className="r-brand-icon">🪪</div>
            <div>
              <div className="r-brand-text">Input KTP Relawan</div>
              <div className="r-brand-sub">{relawanNama || 'Relawan'}</div>
            </div>
          </div>
          <button className="r-logout" onClick={handleLogout} aria-label="Keluar"><LogOut size={16} /></button>
        </div>

        <div className="r-main">
          <h1 className="r-page-title">Scan / Upload KTP</h1>
          <p className="r-page-subtitle">Upload foto KTP, sistem akan otomatis membaca NIK, nama, dan alamat.</p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999,
            background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, marginBottom: 18,
            border: '1px solid #fecaca',
          }}>
            <ShieldAlert size={14} /> Hanya menerima KTP wilayah Kecamatan Balikpapan Utara
          </div>

          <div className="r-card" style={{ padding: 20, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={15} color="#dc2626" />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>Foto KTP</span>
            </div>

            {!preview ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '30px 16px', borderRadius: 14, border: '2px dashed #e2e2e6', background: '#fafafa',
              }}>
                <ImagePlus size={30} color="#9ca3af" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Ambil atau pilih foto KTP</span>
                <span style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>JPG atau PNG</span>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <button type="button" className="r-btn-primary" style={{ padding: '9px 10px', fontSize: 12.5 }} onClick={() => cameraInputRef.current?.click()}>
                    <Camera size={15} /> Kamera
                  </button>
                  <button type="button" className="r-btn-ghost" onClick={() => fileInputRef.current?.click()}>
                    <FolderOpen size={15} /> Galeri/File
                  </button>
                </div>
              </div>
            ) : (
              <>
                <img src={preview} alt="preview KTP" style={{ width: '100%', borderRadius: 12, border: '1px solid #e8e9ec', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button type="button" className="r-btn-ghost" onClick={() => cameraInputRef.current?.click()}>
                    <Camera size={14} /> Ambil Ulang
                  </button>
                  <button type="button" className="r-btn-ghost" onClick={() => fileInputRef.current?.click()}>
                    <FolderOpen size={14} /> Ganti File
                  </button>
                </div>
              </>
            )}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />

            <button className="r-btn-primary" style={{ marginTop: preview ? 0 : 16 }} onClick={runOcr} disabled={!file || ocrLoading}>
              {ocrLoading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              {ocrLoading ? 'Membaca KTP...' : 'Baca Otomatis (OCR)'}
            </button>

            {rejected && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ShieldAlert size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>KTP Ditolak</div>
                    <div style={{ fontSize: 12, color: '#991b1b', marginTop: 3 }}>
                      Wilayah terbaca: <b>{rejected.kecamatanTerbaca}</b>. Bukan Kecamatan Balikpapan Utara.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="r-card" style={{ padding: 20 }}>
            <div className="r-grid">
              <div>
                <label className="r-label">Nama Lengkap</label>
                <input className="r-input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
              </div>
              <div>
                <label className="r-label">NIK</label>
                <input className="r-input" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} />
              </div>
              <div>
                <label className="r-label">Tempat Lahir</label>
                <input className="r-input" value={form.tempat_lahir} onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} />
              </div>
              <div>
                <label className="r-label">Tanggal Lahir</label>
                <input type="date" className="r-input" value={form.tanggal_lahir} onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} />
              </div>
              <div>
                <label className="r-label">Jenis Kelamin</label>
                <select className="r-select" value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                  <option value="">Pilih</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="r-label">Pekerjaan</label>
                <input className="r-input" value={form.pekerjaan} onChange={(e) => setForm({ ...form, pekerjaan: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="r-label">Alamat</label>
                <input className="r-input" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
              </div>
              <div>
                <label className="r-label">No. HP</label>
                <input className="r-input" placeholder="08xxxxxxxxxx" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
              </div>
              <div>
                <label className="r-label">RT</label>
                <input className="r-input" value={form.rt} onChange={(e) => setForm({ ...form, rt: e.target.value })} />
              </div>
              <div>
                <label className="r-label">RW</label>
                <input className="r-input" value={form.rw} onChange={(e) => setForm({ ...form, rw: e.target.value })} />
              </div>
              <div>
                <label className="r-label">Kecamatan</label>
                <input className="r-input" style={{ background: '#f4f5f7', color: '#9ca3af' }} value={DAPIL_KECAMATAN} disabled />
              </div>
              <div>
                <label className="r-label">Kelurahan/Desa</label>
                <select className="r-select" value={form.kelurahan_id} onChange={(e) => setForm({ ...form, kelurahan_id: e.target.value })}>
                  <option value="">Pilih Kelurahan</option>
                  {kelurahanList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="r-label">Agama</label>
                <input className="r-input" value={form.agama} onChange={(e) => setForm({ ...form, agama: e.target.value })} />
              </div>
              <div>
                <label className="r-label">Status Perkawinan</label>
                <input className="r-input" value={form.status_perkawinan} onChange={(e) => setForm({ ...form, status_perkawinan: e.target.value })} />
              </div>
            </div>

            <button className="r-btn-primary" style={{ marginTop: 20 }} onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {saving ? 'Menyimpan...' : 'Simpan Data Pemilih'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RelawanUploadKTP;
