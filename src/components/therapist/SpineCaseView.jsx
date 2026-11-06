import React, { useEffect, useRef, useState } from 'react';
import { HNP_REGIONS, HNP_LAYERS, HNP_DEFAULT_LAYERS } from '@/lib/hnp3d/cases';

// Tampilan kasus HNP (lumbal dan servikal): memutar/zoom model, membandingkan diskus normal vs
// herniasi, dan menyalakan/mematikan lapisan anatomi. Mesin three.js dimuat lazy.

const DISC_SVG = (herniated, uid) => `<svg viewBox="0 0 160 112" role="img" aria-label="${herniated ? 'Diskus dengan herniasi' : 'Diskus normal'}">
  <defs>
    <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d84c4"/><stop offset="1" stop-color="#5d5496"/></linearGradient>
    <radialGradient id="${uid}t" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e4def8"/><stop offset="1" stop-color="#a69cdb"/></radialGradient>
    <radialGradient id="${uid}n" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#bfe0ff"/><stop offset=".6" stop-color="#4f9cf0"/><stop offset="1" stop-color="#2f6fd0"/></radialGradient>
    <radialGradient id="${uid}r" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#ffb4a0"/><stop offset=".5" stop-color="#ff5a42"/><stop offset="1" stop-color="#c42a1e"/></radialGradient>
  </defs>
  <ellipse cx="80" cy="96" rx="62" ry="10" fill="rgba(0,0,0,.35)"/>
  ${herniated ? `<ellipse cx="136" cy="60" rx="21" ry="16" fill="url(#${uid}r)" opacity=".95"/>` : ''}
  <path d="M14 48v16c0 17 29 30 66 30s66-13 66-30V48z" fill="url(#${uid}s)"/>
  <ellipse cx="80" cy="48" rx="66" ry="31" fill="url(#${uid}t)"/>
  <ellipse cx="80" cy="48" rx="57" ry="26.5" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/>
  <ellipse cx="80" cy="48" rx="48" ry="22" fill="none" stroke="rgba(110,98,175,.5)" stroke-width="1.2"/>
  <ellipse cx="80" cy="48" rx="39" ry="18" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/>
  <ellipse cx="${herniated ? 86 : 80}" cy="48" rx="27" ry="12.5" fill="url(#${uid}n)"/>
  ${herniated
    ? `<path d="M96 41c14-4 30-3 40 3 9 5 7 17-3 20-12 3-26 0-37-7z" fill="url(#${uid}r)"/><ellipse cx="124" cy="46" rx="9" ry="3" fill="rgba(255,255,255,.35)"/>`
    : '<ellipse cx="72" cy="43" rx="10" ry="3.6" fill="rgba(255,255,255,.35)"/>'}
</svg>`;

const MINI_NAMES = [
  ...Array.from({ length: 7 }, (_, i) => `C${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `L${i + 1}`),
  'S1',
];
const MiniSpine = ({ upper, lower }) => {
  const a = MINI_NAMES.indexOf(upper), b = MINI_NAMES.indexOf(lower);
  let y = 40;
  const items = MINI_NAMES.map((nm, i) => {
    const t = nm[0];
    const h = t === 'C' ? 5.2 : t === 'T' ? 6.4 : t === 'L' ? 8 : 16;
    const w = t === 'C' ? 9 : t === 'T' ? 12 : t === 'L' ? 16 : 17;
    const cx = 50 + 7 * Math.sin((i / 24) * Math.PI * 2 + 1.3) + (t === 'S' ? 4 : 0);
    const on = i === a || i === b;
    const it = { nm, x: cx - w / 2, y, w, h, on };
    y += h + 1.6;
    return it;
  });
  return (
    <svg viewBox="0 0 100 250" aria-hidden="true">
      <ellipse cx="52" cy="22" rx="13" ry="15" fill="rgba(110,160,230,.18)" stroke="rgba(150,195,255,.4)" />
      <path d="M18 62Q20 44 42 40L62 40Q84 44 86 62L84 150Q88 190 78 224Q62 232 54 226Q44 232 26 224Q16 190 18 150Z" fill="rgba(80,130,200,.1)" stroke="rgba(150,195,255,.3)" />
      {items.map((it) => <rect key={it.nm} x={it.x} y={it.y} width={it.w} height={it.h} rx="2" fill={it.on ? '#ffb347' : '#e0c79d'} />)}
      {items.filter((it) => it.on).map((it) => <rect key={`${it.nm}-hi`} x={it.x - 3} y={it.y - 2} width={it.w + 6} height={it.h + 4} rx="4" fill="none" stroke="#ff4a3a" strokeWidth="1.5" />)}
    </svg>
  );
};

const Tool = ({ icon, label, ...p }) => (
  <button type="button" className="h3d-tool" {...p}>
    <svg viewBox="0 0 28 28" aria-hidden="true">{icon}</svg><span>{label}</span>
  </button>
);

const SpineCaseView = ({ caseKey, onCase, options }) => {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const leadersRef = useRef(null);
  const viewerRef = useRef(null);

  const [, rk, ri] = caseKey.split(':');
  const region = rk, di = Number(ri);
  const [hnp, setHnp] = useState(true);
  const [layers, setLayers] = useState({ ...HNP_DEFAULT_LAYERS });
  const [xray, setXray] = useState(false);
  const [auto, setAuto] = useState(false);
  const [hintGone, setHintGone] = useState(false);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const R = HNP_REGIONS[region];
  const D = R.discs[di];

  // Buat viewer sekali; three.js dimuat terpisah agar bundel dashboard tetap kecil.
  useEffect(() => {
    let disposed = false;
    import('@/lib/hnp3d/spineScene').then(({ createHnpViewer }) => {
      if (disposed) return;
      try {
        viewerRef.current = createHnpViewer({
          canvas: canvasRef.current, stage: stageRef.current, labelsEl: labelsRef.current, leadersEl: leadersRef.current,
          onInteract: () => setHintGone(true),
        });
        setStatus('ready');
      } catch (e) {
        console.error('[Anatomi 3D] gagal membuat viewer', e);
        setStatus('error');
      }
    }).catch((e) => { console.error('[Anatomi 3D] gagal memuat mesin 3D', e); if (!disposed) setStatus('error'); });
    return () => { disposed = true; viewerRef.current?.dispose(); viewerRef.current = null; };
  }, []);

  useEffect(() => { if (status === 'ready') viewerRef.current.setCase(region, di); }, [status, region, di]);
  useEffect(() => { if (status === 'ready') viewerRef.current.setHnp(hnp); }, [status, hnp, region, di]);
  useEffect(() => { if (status === 'ready') viewerRef.current.setLayers(layers); }, [status, layers, region, di]);
  useEffect(() => { if (status === 'ready') viewerRef.current.setXray(xray); }, [status, xray, region, di]);
  useEffect(() => { if (status === 'ready') viewerRef.current.setAuto(auto); }, [status, auto]);

  const reset = () => {
    setLayers({ ...HNP_DEFAULT_LAYERS }); setXray(false); setAuto(false); setHnp(true);
    viewerRef.current?.resetView();
  };

  return (
    <>
      <div className="h3d">
        <section ref={stageRef} className="h3d-stage" aria-label="Model 3D tulang belakang">
          <canvas ref={canvasRef} className="h3d-gl" aria-label="Model 3D interaktif. Seret untuk memutar, scroll atau cubit untuk zoom." />
          <svg ref={leadersRef} className="h3d-leaders" aria-hidden="true" />
          <div ref={labelsRef} className="h3d-labels" aria-hidden="true" />

          <header className="h3d-top">
            <label className="h3d-select">
              <span className="h3d-sr">Pilih kasus HNP</span>
              <select value={caseKey} onChange={(e) => onCase(e.target.value)}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
            </label>
            <div className="h3d-seg" role="tablist" aria-label="Regio tulang belakang">
              {Object.entries(HNP_REGIONS).map(([key, r]) => (
                <button key={key} type="button" role="tab" aria-selected={region === key} onClick={() => onCase(`hnp:${key}:0`)}>{r.label}</button>
              ))}
            </div>
          </header>

          <nav className="h3d-tools" aria-label="Kontrol model">
            <Tool label="Rotate 360°" title="Putar otomatis 360°" aria-pressed={auto} onClick={() => setAuto((v) => !v)}
              icon={<><path d="M22.5 11.5A9 9 0 0 0 6.2 8.8M5.5 16.5a9 9 0 0 0 16.3 2.7" /><path d="M6 4v5h5M22 24v-5h-5" /></>} />
            <Tool label="Zoom In" title="Perbesar" onClick={() => viewerRef.current?.zoom(0.78)}
              icon={<><circle cx="12" cy="12" r="8" /><path d="M18 18l6 6M12 8.5v7M8.5 12h7" /></>} />
            <Tool label="Zoom Out" title="Perkecil" onClick={() => viewerRef.current?.zoom(1.28)}
              icon={<><circle cx="12" cy="12" r="8" /><path d="M18 18l6 6M8.5 12h7" /></>} />
            <Tool label="Layer" title="Mode tembus pandang pada tulang" aria-pressed={xray} onClick={() => setXray((v) => !v)}
              icon={<><path d="M14 4l10 5.5-10 5.5-10-5.5z" /><path d="M4 14l10 5.5L24 14M4 18.5L14 24l10-5.5" /></>} />
            <Tool label="Reset" title="Kembalikan tampilan awal" onClick={reset}
              icon={<><path d="M5 14a9 9 0 1 0 3-6.7" /><path d="M5 5v5h5" /></>} />
          </nav>

          <div className="h3d-mini" aria-hidden="true"><MiniSpine upper={R.levels[D.i]} lower={R.levels[D.i + 1]} /></div>

          <div className="h3d-seg h3d-mode" role="group" aria-label="Kondisi diskus">
            <button type="button" aria-pressed={!hnp} onClick={() => setHnp(false)}>Normal</button>
            <button type="button" aria-pressed={hnp} onClick={() => setHnp(true)}>HNP (Herniasi)</button>
          </div>
          <div className={`h3d-hint${hintGone ? ' gone' : ''}`}>Seret untuk memutar · scroll atau cubit untuk zoom</div>
          {status === 'loading' && <div className="h3d-msg">Memuat model 3D…</div>}
          {status === 'error' && <div className="h3d-msg"><div><b>Model 3D tidak dapat ditampilkan.</b><br />Peramban ini tidak mendukung WebGL atau pustaka 3D gagal dimuat.</div></div>}
        </section>

        <aside className="h3d-panel" aria-live="polite">
          <section className="h3d-card">
            <div className="h3d-head">
              <div className="h3d-ico" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none" stroke="#5b9bff" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6h14M8 12h16M7 18h18M9 24h14" /></svg>
              </div>
              <div><h1>{R.title}</h1><p>(Herniated Nucleus Pulposus) · {D.name}</p></div>
            </div>
            <p className="h3d-desc">{D.desc}</p>
          </section>

          <section className="h3d-card">
            <h2>Perbandingan Diskus</h2>
            <div className="h3d-cmp">
              <figure className={hnp ? '' : 'on'}><div dangerouslySetInnerHTML={{ __html: DISC_SVG(false, 'dn') }} /><figcaption>Diskus Normal</figcaption></figure>
              <figure className={hnp ? 'on' : ''}><div dangerouslySetInnerHTML={{ __html: DISC_SVG(true, 'dh') }} /><figcaption>Diskus dengan HNP</figcaption></figure>
            </div>
          </section>

          <section className="h3d-card">
            <h2>Komponen Anatomi</h2>
            <ul className="h3d-comp">
              {HNP_LAYERS.map((l) => (
                <li key={l.key}>
                  <span className="h3d-dot" style={{ background: l.color }} />
                  <span className="h3d-nm">{l.name}</span>
                  <button type="button" className="h3d-eye" role="switch" aria-checked={layers[l.key]} aria-label={`Tampilkan ${l.name}`}
                    onClick={() => setLayers((p) => ({ ...p, [l.key]: !p[l.key] }))}>
                    {layers[l.key]
                      ? <svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                      : <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 7.5A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="h3d-card">
            <h2>Gambaran klinis · akar saraf {D.root}</h2>
            <ul className="h3d-clin">
              {D.clin.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
            </ul>
          </section>
          <p className="h3d-note">Ilustrasi edukasi dengan model yang disederhanakan. Bukan pengganti pemeriksaan dan diagnosis klinis.</p>
        </aside>
      </div>
    </>
  );
};

export default SpineCaseView;
