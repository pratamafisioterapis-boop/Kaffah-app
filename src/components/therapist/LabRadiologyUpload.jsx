import React, { useRef, useState } from 'react';
import { Loader2, UploadCloud, X, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const BUCKET = 'medical-record-attachments';
const MAX_BYTES = 10 * 1024 * 1024;

const SECTIONS = [
  { key: 'lab', label: 'Laboratory' },
  { key: 'radiology', label: 'Radiology' },
];

const openFile = async (path) => {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
};

const Section = ({ label, clinicId, value, onChange }) => {
  const inputRef = useRef(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const files = value?.files || [];

  const upload = async (list) => {
    const picked = Array.from(list || []).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (!picked.length) return;
    if (!clinicId) {
      toast({ variant: 'destructive', title: 'Klinik tidak ditemukan', description: 'Tidak bisa upload tanpa data klinik.' });
      return;
    }
    setUploading(true);
    const added = [];
    for (const file of picked) {
      if (file.size > MAX_BYTES) {
        toast({ variant: 'destructive', title: 'File terlalu besar', description: `${file.name} melebihi 10 MB.` });
        continue;
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${clinicId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (error) {
        toast({ variant: 'destructive', title: 'Gagal upload', description: error.message });
        continue;
      }
      added.push({ path, name: file.name });
    }
    setUploading(false);
    if (added.length) onChange({ ...value, files: [...files, ...added] });
  };

  const remove = (f) => {
    onChange({ ...value, files: files.filter((x) => x.path !== f.path) });
    supabase.storage.from(BUCKET).remove([f.path]);
  };

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{label}</h4>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-app border border-dashed px-4 py-6 text-sm text-slate-500 transition-colors ${dragging ? 'border-app-accent-bright bg-app-soft' : 'border-slate-300 bg-slate-50/80 hover:bg-slate-100'}`}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        <span>Drag &amp; Drop gambar atau <span className="underline">Browse</span></span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-2 rounded-app-sm border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-app-accent" />
              <button type="button" onClick={() => openFile(f.path)} className="min-w-0 flex-1 truncate text-left text-app-accent-hover hover:underline">
                {f.name}
              </button>
              <button type="button" onClick={() => remove(f)} aria-label={`Hapus ${f.name}`} className="text-slate-400 hover:text-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="mt-3 block text-xs font-semibold text-slate-500">Keterangan</label>
      <Textarea
        placeholder="Tulis keterangan / hasil..."
        className="mt-1 min-h-[90px] resize-none rounded-app border-slate-200 bg-slate-50/80 focus:bg-white"
        value={value?.note || ''}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </div>
  );
};

const LabRadiologyUpload = ({ clinicId, value, onChange }) => (
  <div className="grid gap-5 md:grid-cols-2">
    {SECTIONS.map((s) => (
      <Section
        key={s.key}
        label={s.label}
        clinicId={clinicId}
        value={value?.[s.key]}
        onChange={(v) => onChange({ ...(value || {}), [s.key]: v })}
      />
    ))}
  </div>
);

export default LabRadiologyUpload;
