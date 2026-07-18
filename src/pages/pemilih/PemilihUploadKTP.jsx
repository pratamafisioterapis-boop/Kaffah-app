import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, Check, ShieldAlert, CreditCard, ImagePlus } from 'lucide-react';

const DAPIL_KECAMATAN = 'Balikpapan Utara';

const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const PemilihUploadKTP = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dapilKecamatanId, setDapilKecamatanId] = useState(null);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [rejected, setRejected] = useState(null);
  const [form, setForm] = useState({
    nama: '', nik: '', jenis_kelamin: '', tempat_lahir: '', tanggal_lahir: '',
    alamat: '', rt: '', rw: '', kelurahan_id: '', no_hp: '',
    agama: '', status_perkawinan: '', pekerjaan: '', kategori_dukungan: 'belum_diketahui',
  });

  useEffect(() => {
    const setup = async () => {
      let { data: kec } = await supabase
        .from('pemilih_kecamatan')
        .select('id')
        .ilike('nama', DAPIL_KECAMATAN)
        .maybeSingle();

      if (!kec) {
        const { data: created } = await supabase
          .from('pemilih_kecamatan')
          .insert({ nama: DAPIL_KECAMATAN })
          .select('id')
          .single();
        kec = created;
      }
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
  }, []);

  const resetAll = () => {
    setFile(null);
    setPreview(null);
    setRejected(null);
    setForm({
      nama: '', nik: '', jenis_kelamin: '', tempat_lahir: '', tanggal_lahir: '',
      alamat: '', rt: '', rw: '', kelurahan_id: '', no_hp: '',
      agama: '', status_perkawinan: '', pekerjaan: '', kategori_dukungan: 'belum_diketahui',
    });
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
    if (!dapilKecamatanId) {
      toast({ title: 'Data kecamatan dapil belum siap, coba muat ulang halaman', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let fotoUrl = null;
      if (file) {
        const safeName = (form.nik || form.nama || 'ktp').replace(/[^a-zA-Z0-9-_]/g, '_');
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${safeName}_${Date.now()}.${ext}`;

        const { error: upErr } = await supabase.storage.from('pemilih-ktp').upload(path, file);
        if (upErr) throw new Error(`Gagal upload foto KTP: ${upErr.message}`);

        const { data: signed } = await supabase.storage
          .from('pemilih-ktp')
          .createSignedUrl(path, 60 * 60 * 24 * 365);

        fotoUrl = signed?.signedUrl || null;
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
        kategori_dukungan: form.kategori_dukungan,
        foto_ktp_url: fotoUrl,
        sumber_data: 'ocr_ktp',
        petugas_input: user.id,
      });
      if (error) throw error;

      toast({ title: 'Data pemilih tersimpan' });
      resetAll();
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6, display: 'block' };

  return (
    <div>
      <h1 className="p-page-title">Scan / Upload KTP</h1>
      <p className="p-page-subtitle" style={{ marginBottom: 12 }}>
        Upload foto KTP, sistem akan otomatis membaca NIK, nama, dan alamat.
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999,
        background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, marginBottom: 24,
        border: '1px solid #fecaca',
      }}>
        <ShieldAlert size={14} /> Hanya menerima KTP wilayah Kecamatan Balikpapan Utara
      </div>

      <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 22 }}>
        <div className="p-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={15} color="#dc2626" />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1d29' }}>Foto KTP</span>
          </div>

          {!preview ? (
            <label
              htmlFor="ktp-file-input"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '36px 16px', borderRadius: 14, border: '2px dashed #e2e2e6',
                background: '#fafafa', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <ImagePlus size={30} color="#9ca3af" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Pilih foto KTP</span>
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>JPG atau PNG</span>
            </label>
          ) : (
            <img src={preview} alt="preview KTP" style={{ width: '100%', borderRadius: 12, border: '1px solid #e8e9ec', marginBottom: 14, boxShadow: '0 4px 12px rgba(16,24,40,0.08)' }} />
          )}
          <input
            id="ktp-file-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: preview ? 'block' : 'none', marginBottom: 12, fontSize: 12.5 }}
          />

          <button className="p-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: preview ? 0 : 16 }} onClick={runOcr} disabled={!file || ocrLoading}>
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

        <div className="p-card" style={{ padding: 26 }}>
          <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <label className="p-label">Nama Lengkap</label>
              <input className="p-input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div>
              <label className="p-label">NIK</label>
              <input className="p-input" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Tempat Lahir</label>
              <input className="p-input" value={form.tempat_lahir} onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Tanggal Lahir</label>
              <input type="date" className="p-input" value={form.tanggal_lahir} onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Jenis Kelamin</label>
              <select className="p-select" value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="p-label">Pekerjaan</label>
              <input className="p-input" value={form.pekerjaan} onChange={(e) => setForm({ ...form, pekerjaan: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="p-label">Alamat</label>
              <input className="p-input" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
            </div>
            <div>
              <label className="p-label">No. HP</label>
              <input className="p-input" placeholder="08xxxxxxxxxx" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
            </div>
            <div>
              <label className="p-label">RT</label>
              <input className="p-input" value={form.rt} onChange={(e) => setForm({ ...form, rt: e.target.value })} />
            </div>
            <div>
              <label className="p-label">RW</label>
              <input className="p-input" value={form.rw} onChange={(e) => setForm({ ...form, rw: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Kecamatan</label>
              <input className="p-input" style={{ background: '#f4f5f7', color: '#9ca3af' }} value={DAPIL_KECAMATAN} disabled />
            </div>
            <div>
              <label className="p-label">Kelurahan/Desa</label>
              <select className="p-select" value={form.kelurahan_id} onChange={(e) => setForm({ ...form, kelurahan_id: e.target.value })}>
                <option value="">Pilih Kelurahan</option>
                {kelurahanList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Agama</label>
              <input className="p-input" value={form.agama} onChange={(e) => setForm({ ...form, agama: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Status Perkawinan</label>
              <input className="p-input" value={form.status_perkawinan} onChange={(e) => setForm({ ...form, status_perkawinan: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="p-label">Kategori Dukungan</label>
              <select className="p-select" value={form.kategori_dukungan} onChange={(e) => setForm({ ...form, kategori_dukungan: e.target.value })}>
                <option value="belum_diketahui">Belum Diketahui</option>
                <option value="pendukung">Pendukung</option>
                <option value="simpatisan">Simpatisan</option>
                <option value="netral">Netral</option>
                <option value="tidak_mendukung">Tidak Mendukung</option>
              </select>
            </div>
          </div>

          <button className="p-btn-primary" style={{ marginTop: 22 }} onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
            {saving ? 'Menyimpan...' : 'Simpan Data Pemilih'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PemilihUploadKTP;