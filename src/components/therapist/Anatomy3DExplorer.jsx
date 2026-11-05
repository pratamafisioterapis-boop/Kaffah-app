import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Search, MousePointer2, MapPin, RotateCcw, Camera, Maximize2, Minimize2, Eye, EyeOff,
  Crosshair, Trash2, Layers, Stethoscope, ListTree, Info, FolderOpen, X, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ANATOMY_BUCKET, ANATOMY_LAYERS, COMBINED_MODEL_FILE, LAYER_BY_KEY } from '@/lib/anatomy3d/layers';
import { DIAGNOSIS_PRESETS, compileTargets } from '@/lib/anatomy3d/diagnosisPresets';

// Menu "Anatomi 3D" di akun terapis: model anatomi manusia utuh (tulang, sendi/ligamen, otot,
// saraf, arteri, vena, organ, kulit) dari data scan open-source, untuk menjelaskan ke pasien
// lokasi struktur yang bermasalah. Mesin three.js dimuat terpisah (lazy) karena ukurannya besar.

const TABS = [
  { key: 'diagnosa', label: 'Diagnosa', icon: Stethoscope },
  { key: 'lapisan', label: 'Lapisan', icon: Layers },
  { key: 'struktur', label: 'Struktur', icon: ListTree },
  { key: 'tanda', label: 'Tanda', icon: MapPin },
];

const VIEWS = [
  { key: 'front', label: 'Depan' }, { key: 'back', label: 'Belakang' },
  { key: 'left', label: 'Kiri' }, { key: 'right', label: 'Kanan' }, { key: 'top', label: 'Atas' },
];

const MAX_LIST = 200;
const BUNDLED_LAYERS = ['skeleton', 'muscles'];

const Anatomy3DExplorer = () => {
  const { toast } = useToast();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const localFileRef = useRef(null);
  const panelRef = useRef(null);

  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState('');
  const [storageFiles, setStorageFiles] = useState(null); // null = memeriksa
  // Model bawaan aplikasi (public/models/anatomy). Lapisan dari Supabase menimpa yang bawaan.
  const sources = useMemo(() => {
    if (storageFiles === null) return null;
    const out = Object.fromEntries(BUNDLED_LAYERS.map((k) => [k, `/models/anatomy/${k}.glb`]));
    for (const name of storageFiles) {
      const key = name.replace(/\.glb$/i, '');
      if (key === 'full' || LAYER_BY_KEY[key]) out[key] = supabase.storage.from(ANATOMY_BUCKET).getPublicUrl(name).data.publicUrl;
    }
    return out;
  }, [storageFiles]);
  const [loadState, setLoadState] = useState({}); // key -> { status, progress, error }
  const [layerUi, setLayerUi] = useState(() => Object.fromEntries(ANATOMY_LAYERS.map((l) => [l.key, { visible: l.defaultOn, opacity: l.defaultOpacity ?? 1 }])));
  const [counts, setCounts] = useState({});
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('diagnosa');
  const [mode, setMode] = useState('select');
  const [selected, setSelected] = useState(null);
  const [problems, setProblems] = useState([]);
  const [pins, setPins] = useState([]);
  const [preset, setPreset] = useState(null);
  const [presetHits, setPresetHits] = useState([]);
  const [dxQuery, setDxQuery] = useState('');
  const [structQuery, setStructQuery] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  // ── Mesin 3D ─────────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    let engine;
    import('@/lib/anatomy3d/engine').then(({ AnatomyEngine }) => {
      if (disposed || !canvasRef.current) return;
      try {
        engine = new AnatomyEngine(canvasRef.current, {
          onSelect: setSelected,
          onProblemsChange: setProblems,
          onPinsChange: setPins,
        });
        engineRef.current = engine;
        setEngineReady(true);
      } catch (err) {
        setEngineError(err?.message || 'WebGL tidak tersedia di perangkat ini.');
      }
    }).catch((err) => setEngineError(err?.message || 'Gagal memuat viewer 3D.'));
    return () => { disposed = true; engine?.dispose(); engineRef.current = null; };
  }, []);

  // ── Daftar file model di storage ─────────────────────────────────────
  useEffect(() => {
    supabase.storage.from(ANATOMY_BUCKET).list('', { limit: 100 }).then(({ data, error }) => {
      if (error) { setStorageFiles([]); return; }
      setStorageFiles((data || []).map((f) => f.name).filter((n) => /\.glb$/i.test(n)));
    });
  }, []);

  const syncFromEngine = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    setCounts(e.layerCounts());
    setEntries(e.listEntries());
  }, []);

  const loadUrl = useCallback(async (key, url, fileLayer) => {
    const e = engineRef.current;
    if (!e) return;
    setLoadState((s) => ({ ...s, [key]: { status: 'loading', progress: 0 } }));
    try {
      await e.loadModel(url, fileLayer, (p) => setLoadState((s) => ({ ...s, [key]: { status: 'loading', progress: p } })));
      setLoadState((s) => ({ ...s, [key]: { status: 'done', progress: 1 } }));
      syncFromEngine();
    } catch (err) {
      console.error('[Anatomy3D] gagal memuat', key, err);
      setLoadState((s) => ({ ...s, [key]: { status: 'error', error: err?.message || 'Gagal memuat' } }));
    }
  }, [syncFromEngine]);

  // Muat otomatis: file gabungan, atau lapisan yang aktif secara default.
  useEffect(() => {
    if (!engineReady || !sources) return;
    if (sources.full) { loadUrl('full', sources.full, 'auto'); return; }
    ANATOMY_LAYERS.filter((l) => l.defaultOn && sources[l.key]).forEach((l) => loadUrl(l.key, sources[l.key], l.key));
  }, [engineReady, sources, loadUrl]);

  const ensureLayerLoaded = (key) => {
    if (!sources || sources.full || loadState[key] || loadState.full || loadState.local) return;
    if (sources[key]) loadUrl(key, sources[key], key);
  };

  const setLayer = (key, patch) => {
    const e = engineRef.current;
    setLayerUi((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
    if (!e) return;
    if (patch.visible !== undefined) { e.setLayerVisible(key, patch.visible); if (patch.visible) ensureLayerLoaded(key); }
    if (patch.opacity !== undefined) e.setLayerOpacity(key, patch.opacity);
  };

  const openLocalFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const base = file.name.replace(/\.glb$/i, '').toLowerCase();
    const fileLayer = LAYER_BY_KEY[base] ? base : 'auto';
    loadUrl('local', url, fileLayer).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
  };

  // ── Diagnosa ─────────────────────────────────────────────────────────
  const applyPreset = (p) => {
    const e = engineRef.current;
    if (!e) return;
    if (!p) {
      e.applyPreset(null);
      setPreset(null);
      setPresetHits([]);
      return;
    }
    p.layers.forEach((k) => ensureLayerLoaded(k));
    const hits = e.applyPreset(compileTargets(p), p.layers);
    setLayerUi((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, visible: p.layers.includes(k) }])));
    setPreset(p);
    setPresetHits(hits);
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lapisan yang baru selesai dimuat juga harus ikut disorot oleh preset yang sedang aktif.
  useEffect(() => {
    if (preset && engineRef.current) setPresetHits(engineRef.current.applyPreset(compileTargets(preset), preset.layers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  const filteredPresets = useMemo(() => {
    const q = dxQuery.trim().toLowerCase();
    if (!q) return DIAGNOSIS_PRESETS;
    return DIAGNOSIS_PRESETS.filter((p) => [p.name, ...p.aliases].some((a) => a.toLowerCase().includes(q)));
  }, [dxQuery]);

  const filteredEntries = useMemo(() => {
    const q = structQuery.trim().toLowerCase();
    const list = q ? entries.filter((e) => e.search.includes(q) || e.name.toLowerCase().includes(q)) : entries;
    return list.slice(0, MAX_LIST);
  }, [entries, structQuery]);

  // ── Aksi umum ────────────────────────────────────────────────────────
  const changeMode = (m) => { setMode(m); engineRef.current?.setMode(m); };

  const resetAll = () => {
    const e = engineRef.current;
    if (!e) return;
    applyPreset(null);
    e.showAll();
    e.select(null);
    e.frameAll();
  };

  const download = () => {
    const e = engineRef.current;
    if (!e) return;
    const a = document.createElement('a');
    a.href = e.screenshot();
    a.download = `anatomi-3d-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    toast({ title: 'Gambar tersimpan', description: 'Tangkapan layar anatomi (beserta tanda) sudah diunduh.' });
  };

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else setFullscreen((f) => !f);
    } catch { setFullscreen((f) => !f); }
  };
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const isLoading = Object.values(loadState).some((s) => s.status === 'loading');
  const loadingProgress = (() => {
    const l = Object.values(loadState).filter((s) => s.status === 'loading');
    return l.length ? Math.round((l.reduce((a, s) => a + (s.progress || 0), 0) / l.length) * 100) : 0;
  })();
  const hasModel = entries.length > 0;
  const noModelAvailable = sources !== null && Object.keys(sources).length === 0 && !loadState.local;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-app-ink">Anatomi 3D</h1>
          <p className="text-sm text-app-muted">Jelaskan ke pasien lokasi struktur yang bermasalah: tulang, sendi, otot, saraf, dan pembuluh darah.</p>
        </div>
        <input ref={localFileRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => { openLocalFile(e.target.files?.[0]); e.target.value = ''; }} />
        <Button variant="outline" size="sm" onClick={() => localFileRef.current?.click()}><FolderOpen className="mr-1.5 h-4 w-4" />Buka file .glb</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Viewer ── */}
        <div
          ref={wrapRef}
          className={cn(
            'relative overflow-hidden rounded-app-lg border border-app-border bg-[#1c2127]',
            fullscreen ? 'fixed inset-0 z-[80] rounded-none border-0' : 'h-[62vh] min-h-[420px] lg:h-[74vh]',
          )}
        >
          <div ref={canvasRef} className="absolute inset-0" />

          {/* Toolbar atas */}
          <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-black/55 p-1 backdrop-blur">
              <button type="button" onClick={() => changeMode('select')} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', mode === 'select' ? 'bg-white text-slate-900' : 'text-white/85 hover:text-white')}>
                <MousePointer2 className="h-3.5 w-3.5" />Pilih
              </button>
              <button type="button" onClick={() => changeMode('pin')} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', mode === 'pin' ? 'bg-red-500 text-white' : 'text-white/85 hover:text-white')}>
                <MapPin className="h-3.5 w-3.5" />Tandai nyeri
              </button>
            </div>
            <div className="flex rounded-full bg-black/55 p-1 backdrop-blur">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" onClick={() => engineRef.current?.setView(v.key)} className="rounded-full px-2.5 py-1.5 text-xs font-medium text-white/85 hover:bg-white/15 hover:text-white">{v.label}</button>
              ))}
            </div>
            <div className="ml-auto flex gap-1.5">
              {[
                { icon: RotateCcw, label: 'Atur ulang tampilan', onClick: resetAll },
                { icon: Camera, label: 'Unduh gambar', onClick: download },
                { icon: fullscreen ? Minimize2 : Maximize2, label: fullscreen ? 'Keluar layar penuh' : 'Layar penuh (presentasi ke pasien)', onClick: toggleFullscreen },
              ].map(({ icon: I, label, onClick }) => (
                <button key={label} type="button" title={label} aria-label={label} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"><I className="h-4 w-4" /></button>
              ))}
            </div>
          </div>

          {/* Info struktur terpilih */}
          {selected && (
            <div className="absolute bottom-3 left-3 right-3 mx-auto max-w-md rounded-app-sm bg-white/95 p-3 shadow-xl backdrop-blur sm:right-auto">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{selected.name}</p>
                  <p className="text-xs text-slate-500">{LAYER_BY_KEY[selected.layer]?.label}</p>
                </div>
                <button type="button" aria-label="Tutup" onClick={() => engineRef.current?.select(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant={problems.some((p) => p.id === selected.id) ? 'destructive' : 'outline'} onClick={() => engineRef.current?.toggleProblem(selected.id)}>
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />{problems.some((p) => p.id === selected.id) ? 'Batal tandai' : 'Tandai bermasalah'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => engineRef.current?.focusOn([selected.id])}><Crosshair className="mr-1 h-3.5 w-3.5" />Fokus</Button>
                <Button size="sm" variant="outline" onClick={() => { engineRef.current?.isolate([selected.id, ...problems.map((p) => p.id)]); engineRef.current?.focusOn([selected.id]); }}><Eye className="mr-1 h-3.5 w-3.5" />Isolasi</Button>
                <Button size="sm" variant="outline" onClick={() => { engineRef.current?.hide(selected.id); engineRef.current?.select(null); }}><EyeOff className="mr-1 h-3.5 w-3.5" />Sembunyikan</Button>
              </div>
            </div>
          )}

          {preset && fullscreen && (
            <div className="absolute bottom-3 right-3 max-w-sm rounded-app-sm bg-white/95 p-3 text-sm shadow-xl">
              <p className="font-bold text-red-700">{preset.name}</p>
              <p className="mt-1 text-slate-700">{preset.explain}</p>
            </div>
          )}

          {/* Status */}
          {(!engineReady || isLoading) && !engineError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
                {engineReady ? `Memuat model anatomi… ${loadingProgress}%` : 'Menyiapkan viewer 3D…'}
              </div>
            </div>
          )}
          {engineError && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">Viewer 3D tidak dapat berjalan: {engineError}</div>
          )}
          {engineReady && noModelAvailable && !hasModel && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md rounded-app-lg bg-white p-5 text-sm text-slate-700 shadow-xl">
                <p className="text-base font-bold text-slate-900">Model anatomi belum diunggah</p>
                <p className="mt-2">Menu ini memakai model anatomi open-source (Z-Anatomy / BodyParts3D). File model perlu diunggah satu kali ke Supabase Storage, bucket <code className="rounded bg-slate-100 px-1">{ANATOMY_BUCKET}</code>, dengan nama file:</p>
                <p className="mt-2 font-mono text-xs leading-relaxed">{ANATOMY_LAYERS.map((l) => `${l.key}.glb`).join(', ')}</p>
                <p className="mt-2">Atau satu file gabungan <code className="rounded bg-slate-100 px-1">{COMBINED_MODEL_FILE}</code>. Langkah lengkapnya ada di <code className="rounded bg-slate-100 px-1">docs/ANATOMI_3D_SETUP.md</code>.</p>
                <Button className="mt-4" size="sm" onClick={() => localFileRef.current?.click()}><FolderOpen className="mr-1.5 h-4 w-4" />Coba buka file .glb dari perangkat</Button>
              </div>
            </div>
          )}
          {mode === 'pin' && hasModel && (
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white">Klik pada tubuh untuk menaruh tanda</div>
          )}
        </div>

        {/* ── Panel samping ── */}
        <div className="flex max-h-[75vh] min-h-0 flex-col rounded-app-lg border border-app-border bg-white lg:h-[74vh] lg:max-h-none">
          <div className="grid grid-cols-4 border-b border-app-border">
            {TABS.map(({ key, label, icon: I }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', tab === key ? 'border-b-2 border-app-accent text-app-accent' : 'text-app-muted hover:text-app-ink')}>
                <I className="h-4 w-4" />{label}
                {key === 'tanda' && pins.length + problems.length > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{pins.length + problems.length}</span>}
              </button>
            ))}
          </div>

          <div ref={panelRef} className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'diagnosa' && (
              <div className="space-y-3">
                {preset && (
                  <div className="rounded-app-sm border border-red-200 bg-red-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-red-800">{preset.name}</p>
                      <button type="button" aria-label="Hapus diagnosa" onClick={() => applyPreset(null)} className="text-red-400 hover:text-red-700"><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{preset.explain}</p>
                    <p className="mt-2 text-xs font-semibold text-red-700">
                      {presetHits.length ? `${presetHits.length} struktur disorot` : hasModel ? 'Struktur terkait belum ditemukan di model ini (lapisan mungkin belum dimuat).' : 'Muat model untuk melihat struktur.'}
                    </p>
                    {presetHits.length > 0 && (
                      <div className="mt-1.5 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                        {presetHits.slice(0, 40).map((h) => (
                          <button key={h.id} type="button" onClick={() => { engineRef.current?.select(h.id); engineRef.current?.focusOn([h.id]); }} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-red-800 ring-1 ring-red-200 hover:bg-red-100">{h.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-app-muted" />
                  <Input value={dxQuery} onChange={(e) => setDxQuery(e.target.value)} placeholder="Cari diagnosa (mis. frozen shoulder, HNP)" className="pl-8" />
                </div>
                <div className="space-y-1">
                  {filteredPresets.map((p) => (
                    <button key={p.id} type="button" onClick={() => applyPreset(p)} className={cn('w-full rounded-app-sm px-3 py-2 text-left text-sm hover:bg-app-soft', preset?.id === p.id && 'bg-red-50 font-semibold text-red-800')}>{p.name}</button>
                  ))}
                  {filteredPresets.length === 0 && <p className="px-1 text-sm text-app-muted">Belum ada preset untuk diagnosa ini. Pilih strukturnya manual di tab Struktur, lalu tandai bermasalah.</p>}
                </div>
              </div>
            )}

            {tab === 'lapisan' && (
              <div className="space-y-2">
                {ANATOMY_LAYERS.map((l) => {
                  const st = layerUi[l.key];
                  const ls = loadState[l.key];
                  const available = !!(sources?.[l.key] || sources?.full || loadState.local);
                  return (
                    <div key={l.key} className="rounded-app-sm border border-app-border p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: l.color }} />
                        <span className="flex-1 text-sm font-semibold text-app-ink">{l.label}</span>
                        <span className="text-[11px] text-app-muted">
                          {ls?.status === 'loading' ? `${Math.round((ls.progress || 0) * 100)}%` : ls?.status === 'error' ? 'gagal' : counts[l.key] ? `${counts[l.key]} bagian` : available ? '' : 'tidak ada'}
                        </span>
                        <button type="button" onClick={() => setLayer(l.key, { visible: !st.visible })} aria-label={st.visible ? `Sembunyikan ${l.label}` : `Tampilkan ${l.label}`} className={cn('flex h-8 w-8 items-center justify-center rounded-full', st.visible ? 'bg-app-accent text-white' : 'bg-slate-100 text-slate-500')}>
                          {st.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </div>
                      <input type="range" min="0.05" max="1" step="0.05" value={st.opacity} onChange={(e) => setLayer(l.key, { opacity: Number(e.target.value) })} disabled={!st.visible} aria-label={`Transparansi ${l.label}`} className="mt-2 w-full accent-[var(--app-accent,#0f766e)]" />
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" className="w-full" onClick={() => { engineRef.current?.showAll(); engineRef.current?.frameAll(); }}>Tampilkan semua yang disembunyikan</Button>
              </div>
            )}

            {tab === 'struktur' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-app-muted" />
                  <Input value={structQuery} onChange={(e) => setStructQuery(e.target.value)} placeholder="Cari otot, tulang, saraf… (Inggris/Latin)" className="pl-8" />
                </div>
                <p className="text-[11px] text-app-muted">{entries.length ? `${entries.length} struktur di model${filteredEntries.length >= MAX_LIST ? ` · menampilkan ${MAX_LIST} pertama` : ''}` : 'Belum ada model yang dimuat.'}</p>
                <div className="space-y-0.5">
                  {filteredEntries.map((e) => (
                    <button key={e.id} type="button" onClick={() => { engineRef.current?.select(e.id); engineRef.current?.focusOn([e.id]); }} className={cn('flex w-full items-center gap-2 rounded-app-sm px-2 py-1.5 text-left text-sm hover:bg-app-soft', selected?.id === e.id && 'bg-app-soft font-semibold')}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LAYER_BY_KEY[e.layer]?.color }} />
                      <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'tanda' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-app-muted">Titik nyeri / lokasi ({pins.length})</p>
                  {pins.length === 0 && <p className="text-sm text-app-muted">Pilih mode <b>Tandai nyeri</b> lalu klik pada tubuh.</p>}
                  <div className="space-y-2">
                    {pins.map((p) => (
                      <div key={p.id} className="rounded-app-sm border border-app-border p-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">{p.n}</span>
                          <button type="button" onClick={() => engineRef.current?.focusPin(p.id)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-app-ink hover:underline">{p.structure || 'Lokasi'}</button>
                          <button type="button" aria-label="Hapus tanda" onClick={() => engineRef.current?.removePin(p.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <Input value={p.note} onChange={(e) => engineRef.current?.updatePinNote(p.id, e.target.value)} placeholder="Catatan (mis. nyeri tekan, VAS 6)" className="mt-1.5 h-8 text-xs" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-app-muted">Struktur bermasalah ({problems.length})</p>
                  {problems.length === 0 && <p className="text-sm text-app-muted">Klik struktur lalu pilih <b>Tandai bermasalah</b>.</p>}
                  <div className="flex flex-wrap gap-1">
                    {problems.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800 ring-1 ring-red-200">
                        <button type="button" onClick={() => engineRef.current?.focusOn([p.id])}>{p.name}</button>
                        <button type="button" aria-label={`Hapus ${p.name}`} onClick={() => engineRef.current?.toggleProblem(p.id, false)}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
                {(pins.length > 0 || problems.length > 0) && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { engineRef.current?.clearPins(); engineRef.current?.clearProblems(); }}><Trash2 className="mr-1 h-3.5 w-3.5" />Hapus semua</Button>
                    <Button size="sm" className="flex-1" onClick={download}><Camera className="mr-1 h-3.5 w-3.5" />Unduh gambar</Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-1.5 border-t border-app-border px-3 py-2 text-[10.5px] leading-snug text-app-muted">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Model anatomi: Z-Anatomy (CC BY-SA 4.0) berbasis BodyParts3D © DBCLS (CC BY-SA 2.1 JP). Sorotan diagnosa menunjukkan lokasi struktur, bukan gambaran kondisi pasien.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Anatomy3DExplorer;
