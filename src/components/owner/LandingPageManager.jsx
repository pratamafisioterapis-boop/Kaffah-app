import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Plus, Trash2, Palette, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { LANDING_TEMPLATES, getLandingTemplate, mergeLandingContent } from '@/config/landingTemplates';

const APP_DOMAIN = 'clinara.id';

// Small helper to read/write a nested path like "hero.title" on the content
// object being edited, without needing a full form-state library for what
// is, structurally, just a handful of nested text fields + repeatable lists.
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
const setPath = (obj, path, value) => {
  const keys = path.split('.');
  const next = { ...obj };
  let cursor = next;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      cursor[key] = value;
    } else {
      cursor[key] = { ...(cursor[key] || {}) };
      cursor = cursor[key];
    }
  });
  return next;
};

const Field = ({ label, value, onChange, textarea, placeholder }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-slate-600">{label}</label>
    {textarea ? (
      <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="text-sm" />
    ) : (
      <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    )}
  </div>
);

// Generic editor for repeatable item lists (services, advantages,
// testimonials) so we don't need a bespoke component per section --
// `fields` describes which keys each item has and their labels.
const ListEditor = ({ items, onChange, fields, emptyItem }) => {
  const items_ = Array.isArray(items) ? items : [];
  const update = (idx, key, value) => {
    const next = items_.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    onChange(next);
  };
  const remove = (idx) => onChange(items_.filter((_, i) => i !== idx));
  const add = () => onChange([...items_, { ...emptyItem }]);

  return (
    <div className="space-y-3">
      {items_.map((item, idx) => (
        <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2 relative bg-slate-50/50">
          <button
            type="button"
            onClick={() => remove(idx)}
            className="absolute top-2 right-2 text-slate-400 hover:text-red-600"
            title="Hapus"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              value={item[f.key]}
              textarea={f.textarea}
              onChange={(v) => update(idx, f.key, v)}
            />
          ))}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Tambah
      </Button>
    </div>
  );
};

const LandingPageManager = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();

  const [clinic, setClinic] = useState(null);
  const [templateId, setTemplateId] = useState('aurora');
  const [content, setContent] = useState({});
  const [primaryColor, setPrimaryColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [saving, setSaving] = useState(false);

  const [pricelist, setPricelist] = useState([]);
  const [savingPricelist, setSavingPricelist] = useState(false);

  const fetchClinic = async () => {
    if (!userDetails?.clinic_id) return;
    const { data } = await supabase
      .from('clinics')
      .select('id, subdomain, custom_domain, landing_template, landing_content, landing_primary_color, landing_accent_color')
      .eq('id', userDetails.clinic_id)
      .single();
    if (data) {
      setClinic(data);
      const tpl = getLandingTemplate(data.landing_template);
      setTemplateId(tpl.id);
      setContent(mergeLandingContent(tpl.defaultContent, data.landing_content));
      setPrimaryColor(data.landing_primary_color || '');
      setAccentColor(data.landing_accent_color || '');
    }
  };

  const fetchPricelist = async () => {
    if (!userDetails?.clinic_id) return;
    const { data } = await supabase
      .from('clinic_pricelist')
      .select('*')
      .eq('clinic_id', userDetails.clinic_id)
      .order('sort_order');
    setPricelist(data || []);
  };

  useEffect(() => { fetchClinic(); fetchPricelist(); }, [userDetails?.clinic_id]);

  const handleSelectTemplate = (id) => {
    setTemplateId(id);
    const tpl = getLandingTemplate(id);
    // Keep whatever the owner has already written, only fill gaps with the
    // newly selected template's own sample content.
    setContent((prev) => mergeLandingContent(tpl.defaultContent, prev));
  };

  const field = (path) => ({
    value: getPath(content, path),
    onChange: (v) => setContent((prev) => setPath(prev, path, v)),
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('clinics')
      .update({
        landing_template: templateId,
        landing_content: content,
        landing_primary_color: primaryColor || null,
        landing_accent_color: accentColor || null,
      })
      .eq('id', clinic.id);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    toast({ title: 'Landing page berhasil disimpan' });
  };

  const updatePricelistRow = (id, key, value) => {
    setPricelist((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const addPricelistRow = () => {
    setPricelist((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, clinic_id: userDetails.clinic_id, category: '', name: '', description: '', price: 0, price_unit: 'sesi', is_active: true, sort_order: prev.length, _new: true },
    ]);
  };

  const removePricelistRow = async (row) => {
    if (!row._new) {
      const { error } = await supabase.from('clinic_pricelist').delete().eq('id', row.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
        return;
      }
    }
    setPricelist((prev) => prev.filter((r) => r.id !== row.id));
  };

  const handleSavePricelist = async () => {
    setSavingPricelist(true);
    for (const row of pricelist) {
      const payload = {
        clinic_id: userDetails.clinic_id,
        category: row.category || null,
        name: row.name,
        description: row.description || null,
        price: Number(row.price) || 0,
        price_unit: row.price_unit || 'sesi',
        is_active: row.is_active !== false,
        sort_order: row.sort_order || 0,
      };
      if (row._new) {
        if (!payload.name) continue;
        await supabase.from('clinic_pricelist').insert(payload);
      } else {
        await supabase.from('clinic_pricelist').update(payload).eq('id', row.id);
      }
    }
    setSavingPricelist(false);
    toast({ title: 'Daftar harga disimpan' });
    fetchPricelist();
  };

  if (!clinic) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>;
  }

  const previewHost = clinic.custom_domain || (clinic.subdomain ? `${clinic.subdomain}.${APP_DOMAIN}` : null);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Landing Page Klinik</h2>
          <p className="text-sm text-slate-500">Atur tema, warna, isi, dan daftar harga untuk situs publik klinik Anda.</p>
        </div>
        {previewHost && (
          <a
            href={`https://${previewHost}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
          >
            Lihat situs klinik <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Template picker */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Pilih Gaya Landing Page</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {LANDING_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleSelectTemplate(tpl.id)}
              className={cn(
                'relative text-left rounded-xl border-2 p-3 transition-all hover:shadow-md',
                templateId === tpl.id ? 'border-indigo-600 shadow-md' : 'border-slate-200'
              )}
            >
              {templateId === tpl.id && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
              <div className="w-full h-12 mb-2.5 rounded-lg" style={{ background: `linear-gradient(135deg, ${tpl.swatch[0]}, ${tpl.swatch[1]})` }} />
              <p className="text-sm font-semibold text-slate-800">{tpl.name}</p>
              <p className="text-xs text-slate-500 mt-1 leading-snug">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-800">Warna (opsional)</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">Kosongkan untuk memakai warna bawaan template di atas.</p>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Warna Utama</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor || getLandingTemplate(templateId).colors.primary} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-9 rounded border border-slate-200" />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder={getLandingTemplate(templateId).colors.primary} className="w-32 text-sm" />
              {primaryColor && <Button type="button" variant="ghost" size="sm" onClick={() => setPrimaryColor('')}>Reset</Button>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Warna Aksen</label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor || getLandingTemplate(templateId).colors.accent} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-9 rounded border border-slate-200" />
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder={getLandingTemplate(templateId).colors.accent} className="w-32 text-sm" />
              {accentColor && <Button type="button" variant="ghost" size="sm" onClick={() => setAccentColor('')}>Reset</Button>}
            </div>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8">
        <h3 className="text-sm font-semibold text-slate-800">Isi Konten</h3>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Hero</p>
          <Field label="Label kecil di atas judul" {...field('hero.eyebrow')} />
          <Field label="Judul Utama" {...field('hero.title')} />
          <Field label="Sub-judul" textarea {...field('hero.subtitle')} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Teks tombol booking" {...field('hero.ctaLabel')} />
            <Field label="Teks tombol WhatsApp" {...field('hero.ctaWhatsappLabel')} />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tentang Kami</p>
          <Field label="Judul" {...field('about.title')} />
          <Field label="Deskripsi" textarea {...field('about.body')} />
          <Field
            label="Poin keunggulan (satu per baris)"
            textarea
            value={(getPath(content, 'about.points') || []).join('\n')}
            onChange={(v) => setContent((prev) => setPath(prev, 'about.points', v.split('\n').filter((l) => l.trim())))}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Layanan</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Judul bagian" {...field('services.title')} />
            <Field label="Sub-judul bagian" {...field('services.subtitle')} />
          </div>
          <ListEditor
            items={content.services?.items}
            onChange={(items) => setContent((prev) => setPath(prev, 'services.items', items))}
            fields={[{ key: 'title', label: 'Nama Layanan' }, { key: 'description', label: 'Deskripsi', textarea: true }]}
            emptyItem={{ title: '', description: '' }}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Keunggulan</p>
          <Field label="Judul bagian" {...field('advantages.title')} />
          <ListEditor
            items={content.advantages?.items}
            onChange={(items) => setContent((prev) => setPath(prev, 'advantages.items', items))}
            fields={[{ key: 'title', label: 'Judul' }, { key: 'description', label: 'Deskripsi', textarea: true }]}
            emptyItem={{ title: '', description: '' }}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Testimoni</p>
          <Field label="Judul bagian" {...field('testimonials.title')} />
          <ListEditor
            items={content.testimonials?.items}
            onChange={(items) => setContent((prev) => setPath(prev, 'testimonials.items', items))}
            fields={[{ key: 'name', label: 'Nama Pasien' }, { key: 'role', label: 'Keterangan' }, { key: 'quote', label: 'Testimoni', textarea: true }]}
            emptyItem={{ name: '', role: '', quote: '' }}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Daftar Harga (teks pengantar)</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Judul bagian" {...field('pricing.title')} />
            <Field label="Sub-judul bagian" {...field('pricing.subtitle')} />
          </div>
          <Field label="Catatan kecil di bawah harga" {...field('pricing.note')} />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ajakan Booking (CTA)</p>
          <Field label="Judul" {...field('cta.title')} />
          <Field label="Sub-judul" textarea {...field('cta.subtitle')} />
          <Field label="Teks tombol" {...field('cta.buttonLabel')} />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Footer</p>
          <Field label="Tagline singkat" {...field('footer.tagline')} />
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Landing Page
          </Button>
        </div>
      </div>

      {/* Pricelist */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Daftar Harga Layanan</h3>
          <p className="text-xs text-slate-500">Ditampilkan pada bagian harga di landing page klinik Anda.</p>
        </div>

        <div className="space-y-3">
          {pricelist.map((row) => (
            <div key={row.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <div className="sm:col-span-3">
                <Input value={row.category || ''} onChange={(e) => updatePricelistRow(row.id, 'category', e.target.value)} placeholder="Kategori (mis. Fisioterapi)" className="text-sm" />
              </div>
              <div className="sm:col-span-3">
                <Input value={row.name || ''} onChange={(e) => updatePricelistRow(row.id, 'name', e.target.value)} placeholder="Nama layanan" className="text-sm" />
              </div>
              <div className="sm:col-span-3">
                <Input value={row.description || ''} onChange={(e) => updatePricelistRow(row.id, 'description', e.target.value)} placeholder="Deskripsi singkat" className="text-sm" />
              </div>
              <div className="sm:col-span-1">
                <Input type="number" min="0" value={row.price ?? 0} onChange={(e) => updatePricelistRow(row.id, 'price', e.target.value)} placeholder="Harga" className="text-sm" />
              </div>
              <div className="sm:col-span-1">
                <Input value={row.price_unit || 'sesi'} onChange={(e) => updatePricelistRow(row.id, 'price_unit', e.target.value)} placeholder="/sesi" className="text-sm" />
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => removePricelistRow(row)} className="text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={addPricelistRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Tambah Item Harga
          </Button>
          <Button onClick={handleSavePricelist} disabled={savingPricelist} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            {savingPricelist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Daftar Harga
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingPageManager;
