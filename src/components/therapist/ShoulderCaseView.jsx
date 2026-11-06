import React, { useEffect, useRef, useState } from 'react';
import { SHOULDER_CASE, SHOULDER_STAGES, SHOULDER_MOTIONS } from '@/lib/hnp3d/cases';

// Tampilan kasus Frozen Shoulder: empat tab (Anatomi, Patologi, Gerakan, Terapi) di atas model
// 3D bahu. Gambar mini kapsul dirender dari model yang sama oleh mesin (snapshots).

const Tool = ({ icon, label, ...p }) => (
  <button type="button" className="h3d-tool" {...p}>
    <svg viewBox="0 0 28 28" aria-hidden="true">{icon}</svg><span>{label}</span>
  </button>
);

// Ikon pose sederhana untuk tiga gerakan yang terbatas.
const MotionIcon = ({ kind }) => {
  const skin = '#d3a67f', arc = '#4f9bff';
  return (
    <svg viewBox="0 0 100 80" role="img" aria-hidden="true">
      <circle cx="50" cy="14" r="9" fill={skin} />
      <path d="M36 28h28l4 36H32z" fill="#3b6bb5" />
      {kind === 'flexion' && <>
        <line x1="62" y1="31" x2="86" y2="20" stroke={skin} strokeWidth="8" strokeLinecap="round" />
        <path d="M70 60Q90 52 91 28" fill="none" stroke={arc} strokeWidth="2.5" strokeDasharray="4 3" /><path d="M86 31l5-5 3 7z" fill={arc} />
        <line x1="38" y1="31" x2="36" y2="60" stroke={skin} strokeWidth="8" strokeLinecap="round" />
      </>}
      {kind === 'abduction' && <>
        <line x1="64" y1="32" x2="88" y2="38" stroke={skin} strokeWidth="8" strokeLinecap="round" />
        <path d="M72 62Q92 62 92 44" fill="none" stroke={arc} strokeWidth="2.5" strokeDasharray="4 3" /><path d="M88 47l4-6 4 6z" fill={arc} />
        <line x1="36" y1="32" x2="30" y2="60" stroke={skin} strokeWidth="8" strokeLinecap="round" />
      </>}
      {kind === 'er' && <>
        <line x1="64" y1="32" x2="68" y2="52" stroke={skin} strokeWidth="8" strokeLinecap="round" />
        <line x1="68" y1="52" x2="88" y2="44" stroke={skin} strokeWidth="8" strokeLinecap="round" />
        <path d="M70 70Q92 70 92 56" fill="none" stroke={arc} strokeWidth="2.5" strokeDasharray="4 3" /><path d="M88 58l4-6 4 6z" fill={arc} />
        <line x1="36" y1="32" x2="32" y2="58" stroke={skin} strokeWidth="8" strokeLinecap="round" />
      </>}
    </svg>
  );
};

const BodyMini = () => (
  <svg viewBox="0 0 100 130" aria-hidden="true">
    <defs><radialGradient id="shg"><stop offset="0" stopColor="#ff7a4a" /><stop offset="1" stopColor="#ff4a3a" stopOpacity="0" /></radialGradient></defs>
    <circle cx="50" cy="22" r="13" fill="rgba(110,160,230,.2)" stroke="rgba(150,195,255,.45)" />
    <path d="M8 120Q8 52 32 44Q40 40 50 40Q60 40 68 44Q92 52 92 120Z" fill="rgba(80,130,200,.16)" stroke="rgba(150,195,255,.4)" />
    <circle cx="26" cy="58" r="20" fill="url(#shg)" />
    <circle cx="26" cy="58" r="6" fill="#ffb347" />
    <path d="M24 62L20 100" stroke="#e0c79d" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

const ShoulderCaseView = ({ caseKey, onCase, options }) => {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const leadersRef = useRef(null);
  const viewerRef = useRef(null);

  const [tab, setTab] = useState('anatomi');
  const [frozen, setFrozen] = useState(true);
  const [stageNo, setStageNo] = useState(2);
  const [muscles, setMuscles] = useState(true);
  const [auto, setAuto] = useState(false);
  const [motion, setMotion] = useState('flexion');
  const [rom, setRom] = useState(null);
  const [thumbs, setThumbs] = useState(null);
  const [hintGone, setHintGone] = useState(false);
  const [status, setStatus] = useState('loading');

  const stg = SHOULDER_STAGES[stageNo - 1];
  const mo = SHOULDER_MOTIONS.find((m) => m.key === motion);

  useEffect(() => {
    let disposed = false;
    import('@/lib/hnp3d/shoulderScene').then(({ createShoulderViewer }) => {
      if (disposed) return;
      try {
        const v = createShoulderViewer({
          canvas: canvasRef.current, stage: stageRef.current, labelsEl: labelsRef.current, leadersEl: leadersRef.current,
          onInteract: () => setHintGone(true), onRom: setRom,
        });
        viewerRef.current = v;
        try { setThumbs(v.snapshots()); } catch (e) { console.warn('[Anatomi 3D] gambar mini gagal dibuat', e); }
        setStatus('ready');
      } catch (e) { console.error('[Anatomi 3D] gagal membuat viewer', e); setStatus('error'); }
    }).catch((e) => { console.error('[Anatomi 3D] gagal memuat mesin 3D', e); if (!disposed) setStatus('error'); });
    return () => { disposed = true; viewerRef.current?.dispose(); viewerRef.current = null; };
  }, []);

  const ready = status === 'ready';
  useEffect(() => { if (ready) viewerRef.current.setTab(tab); }, [ready, tab]);
  useEffect(() => { if (ready) viewerRef.current.setCondition(frozen); }, [ready, frozen]);
  useEffect(() => { if (ready) viewerRef.current.setStage(stageNo); }, [ready, stageNo]);
  useEffect(() => { if (ready) viewerRef.current.setMuscles(muscles); }, [ready, muscles]);
  useEffect(() => { if (ready) viewerRef.current.setMotion(motion); }, [ready, motion]);
  useEffect(() => { if (ready) viewerRef.current.setAuto(auto); }, [ready, auto]);

  const reset = () => { setMuscles(true); setAuto(false); setFrozen(true); viewerRef.current?.resetView(); };

  const Thumb = ({ src, alt }) => (src ? <img src={src} alt={alt} className="h3d-img" /> : <div className="h3d-img h3d-img-empty" />);

  return (
    <div className="h3d">
      <section ref={stageRef} className="h3d-stage" aria-label="Model 3D bahu">
        <canvas ref={canvasRef} className="h3d-gl" aria-label="Model 3D interaktif bahu. Seret untuk memutar, scroll atau cubit untuk zoom." />
        <svg ref={leadersRef} className="h3d-leaders" aria-hidden="true" />
        <div ref={labelsRef} className="h3d-labels" aria-hidden="true" />

        <header className="h3d-top">
          <label className="h3d-select">
            <span className="h3d-sr">Pilih kasus</span>
            <select value={caseKey} onChange={(e) => onCase(e.target.value)}>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
          </label>
          <div className="h3d-seg" role="tablist" aria-label="Mode tampilan">
            {SHOULDER_CASE.tabs.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
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
          <Tool label="Layer" title="Tampilkan atau sembunyikan otot rotator cuff" aria-pressed={!muscles} onClick={() => setMuscles((v) => !v)}
            icon={<><path d="M14 4l10 5.5-10 5.5-10-5.5z" /><path d="M4 14l10 5.5L24 14M4 18.5L14 24l10-5.5" /></>} />
          <Tool label="Reset" title="Kembalikan tampilan awal" onClick={reset}
            icon={<><path d="M5 14a9 9 0 1 0 3-6.7" /><path d="M5 5v5h5" /></>} />
        </nav>

        <div className="h3d-mini" aria-hidden="true"><BodyMini /></div>

        {tab === 'gerakan' && (
          <div className="h3d-motion">
            <div className="h3d-seg" role="group" aria-label="Jenis gerakan">
              {SHOULDER_MOTIONS.map((m) => <button key={m.key} type="button" aria-pressed={motion === m.key} onClick={() => setMotion(m.key)}>{m.label}</button>)}
            </div>
            <div className="h3d-rom" aria-live="off">
              <b>{rom ? rom.angle : 0}°</b> dari rentang {frozen ? `${rom?.limit ?? '…'}°` : `${mo.normal}°`}
              <span>{frozen ? `(normal ${mo.normal}°)` : '(normal)'}</span>
            </div>
          </div>
        )}

        <div className="h3d-seg h3d-mode" role="group" aria-label="Kondisi sendi">
          <button type="button" aria-pressed={!frozen} onClick={() => setFrozen(false)}>Normal</button>
          <button type="button" aria-pressed={frozen} onClick={() => setFrozen(true)}>Frozen Shoulder</button>
        </div>
        <div className={`h3d-hint${hintGone || tab === 'gerakan' ? ' gone' : ''}`}>Seret untuk memutar · scroll atau cubit untuk zoom</div>
        {status === 'loading' && <div className="h3d-msg">Memuat model 3D…</div>}
        {status === 'error' && <div className="h3d-msg"><div><b>Model 3D tidak dapat ditampilkan.</b><br />Peramban ini tidak mendukung WebGL atau pustaka 3D gagal dimuat.</div></div>}
      </section>

      <aside className="h3d-panel" aria-live="polite">
        <section className="h3d-card">
          <div className="h3d-head">
            <div className="h3d-ico" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" stroke="#5b9bff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12c0-4 4-6 8-6s6 2 6 5M6 12c0 6 2 9 2 14M20 11c3 0 6 2 6 7v8" /></svg>
            </div>
            <div><h1>{SHOULDER_CASE.title}</h1><p>{SHOULDER_CASE.sub}</p></div>
          </div>
          <p className="h3d-desc">{SHOULDER_CASE.desc}</p>
        </section>

        {tab === 'anatomi' && (
          <section className="h3d-card">
            <h2>Perbandingan Kapsul Sendi</h2>
            <div className="h3d-cmp">
              <figure className={frozen ? '' : 'on'}><Thumb src={thumbs?.normal} alt="Kapsul sendi normal" /><figcaption>Kapsul Normal</figcaption></figure>
              <figure className={frozen ? 'on' : ''}><Thumb src={thumbs?.[`s${stageNo}`]} alt="Kapsul frozen shoulder" /><figcaption>Frozen Shoulder<small>(kapsul menebal &amp; kaku)</small></figcaption></figure>
            </div>
          </section>
        )}

        {(tab === 'anatomi' || tab === 'patologi' || tab === 'terapi') && (
          <section className="h3d-card">
            <h2>Tahapan Frozen Shoulder</h2>
            <div className="h3d-stages" role="group" aria-label="Tahap frozen shoulder">
              {SHOULDER_STAGES.map((s) => (
                <button key={s.k} type="button" className={stageNo === s.k ? 'on' : ''} aria-pressed={stageNo === s.k}
                  onClick={() => { setStageNo(s.k); setFrozen(true); }}>
                  <Thumb src={thumbs?.[`s${s.k}`]} alt={`Tahap ${s.k}`} />
                  <span>{s.k}. {s.name}<small>{s.sub}</small><small>{s.dur}</small></span>
                </button>
              ))}
            </div>
            {tab !== 'anatomi' && <p className="h3d-desc">{stg.path}</p>}
          </section>
        )}

        {tab === 'patologi' && (
          <section className="h3d-card">
            <h2>Mekanisme</h2>
            <ul className="h3d-clin h3d-bul">{SHOULDER_CASE.mechanism.map((m) => <li key={m}><span>{m}</span></li>)}</ul>
          </section>
        )}

        {tab === 'terapi' && (
          <section className="h3d-card">
            <h2>Contoh program · tahap {stg.k} {stg.sub}</h2>
            <ul className="h3d-clin h3d-bul">{stg.therapy.map((m) => <li key={m}><span>{m}</span></li>)}</ul>
            <p className="h3d-desc" style={{ fontSize: 12.5 }}>Contoh umum; sesuaikan dengan asesmen dan toleransi pasien.</p>
          </section>
        )}

        {(tab === 'anatomi' || tab === 'gerakan') && (
          <section className="h3d-card">
            <h2>Keterbatasan Gerak (Umum)</h2>
            <div className="h3d-motions">
              {SHOULDER_MOTIONS.map((m) => (
                <button key={m.key} type="button" className={tab === 'gerakan' && motion === m.key ? 'on' : ''}
                  onClick={() => { setMotion(m.key); setTab('gerakan'); }}>
                  <MotionIcon kind={m.key} />
                  <b>{m.label}</b><small>({m.hint}) terbatas</small>
                </button>
              ))}
            </div>
          </section>
        )}
        <p className="h3d-note">Ilustrasi edukasi dengan model yang disederhanakan. Bukan pengganti pemeriksaan dan diagnosis klinis.</p>
      </aside>
    </div>
  );
};

export default ShoulderCaseView;
