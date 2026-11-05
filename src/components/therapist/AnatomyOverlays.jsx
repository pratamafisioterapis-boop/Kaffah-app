import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Overlay HTML di atas kanvas Anatomi 3D: label dengan garis penunjuk (mengikuti rotasi/zoom
// kamera) dan mini peta tubuh. Posisi diperbarui langsung ke DOM setiap frame, tanpa render React.

const BOX_W_FALLBACK = 150;
const GAP = 46;

export const AnatomyLabels = ({ engine, labels, active }) => {
  const wrapRef = useRef(null);
  const boxRefs = useRef([]);
  const lineRefs = useRef([]);
  const dotRefs = useRef([]);

  useEffect(() => {
    if (!engine || !labels.length) return undefined;
    const place = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      const pts = labels.map((l) => engine.project(l.ids));
      const side = (p) => (p && p.x < W / 2 ? 'L' : 'R');
      const slots = { L: [], R: [] };
      pts.forEach((p, i) => { if (p?.visible) slots[side(p)].push(i); });
      for (const s of ['L', 'R']) {
        const idx = slots[s].sort((a, b) => pts[a].y - pts[b].y);
        // Susun vertikal agar kotak label tidak saling menimpa.
        let last = 60 - GAP;
        const ys = {};
        idx.forEach((i) => { ys[i] = Math.max(Math.min(pts[i].y, H - 90), last + GAP); last = ys[i]; });
        idx.forEach((i) => {
          const box = boxRefs.current[i];
          const line = lineRefs.current[i];
          const dot = dotRefs.current[i];
          if (!box || !line || !dot) return;
          const bw = box.offsetWidth || BOX_W_FALLBACK;
          const bh = box.offsetHeight || 32;
          const x = s === 'L' ? (W >= 640 ? 72 : 12) : W - bw - 70; // kiri: ruang untuk peta tubuh // sisi kanan memberi ruang bagi rail zoom
          const y = Math.min(ys[i], H - 90) - bh / 2;
          box.style.transform = `translate(${x}px, ${y}px)`;
          box.style.opacity = '1';
          const ex = s === 'L' ? x + bw : x;
          line.setAttribute('x1', ex); line.setAttribute('y1', y + bh / 2);
          line.setAttribute('x2', pts[i].x); line.setAttribute('y2', pts[i].y);
          line.style.opacity = '1';
          dot.setAttribute('cx', pts[i].x); dot.setAttribute('cy', pts[i].y);
          dot.style.opacity = '1';
        });
      }
      labels.forEach((_, i) => {
        if (pts[i]?.visible) return;
        if (boxRefs.current[i]) boxRefs.current[i].style.opacity = '0';
        if (lineRefs.current[i]) lineRefs.current[i].style.opacity = '0';
        if (dotRefs.current[i]) dotRefs.current[i].style.opacity = '0';
      });
    };
    place();
    return engine.onFrame(place);
  }, [engine, labels]);

  if (!labels.length) return null;
  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full">
        {labels.map((l, i) => (
          <g key={l.key}>
            <line ref={(el) => { lineRefs.current[i] = el; }} stroke={l.tone === 'problem' && active ? '#fca5a5' : 'rgba(255,255,255,.75)'} strokeWidth="1.2" style={{ opacity: 0 }} />
            <circle ref={(el) => { dotRefs.current[i] = el; }} r="3" fill={l.tone === 'problem' && active ? '#ff4d4d' : '#fff'} stroke="#0008" strokeWidth="1" style={{ opacity: 0 }} />
          </g>
        ))}
      </svg>
      {labels.map((l, i) => (
        <div
          key={l.key}
          ref={(el) => { boxRefs.current[i] = el; }}
          style={{ opacity: 0 }}
          className={cn(
            'absolute left-0 top-0 max-w-[170px] rounded-md px-2.5 py-1 text-center text-[11px] font-semibold leading-tight shadow-lg ring-1',
            l.tone === 'problem' && active ? 'bg-red-800/95 text-white ring-red-300/60' : 'bg-slate-100/95 text-slate-900 ring-white/60',
          )}
        >
          {l.text}
          {l.sub && <div className="text-[10px] font-normal opacity-80">{l.sub}</div>}
        </div>
      ))}
    </div>
  );
};

// Siluet tubuh sederhana (tampak depan) dengan penanda lokasi diagnosa.
export const BodyLocator = ({ pos, className }) => {
  if (!pos) return null;
  const cy = 6 + Math.min(1, Math.max(0, pos.y)) * 150;
  const cx = 30 + (Math.min(1, Math.max(0, pos.x)) - 0.5) * 36;
  return (
    <div className={cn('rounded-xl border border-white/20 bg-black/45 p-1.5 backdrop-blur', className)} aria-label="Lokasi pada tubuh">
      <svg viewBox="0 0 60 164" className="h-[120px] w-[44px]">
        <g fill="rgba(180,205,235,.35)" stroke="rgba(200,220,245,.7)" strokeWidth="1">
          <circle cx="30" cy="9" r="7" />
          <path d="M22 18h16l9 6 5 34-5 2-4-24-3 52 2 50h-8l-3-46-3 46h-8l2-50-3-52-4 24-5-2 5-34z" />
        </g>
        <circle cx={cx} cy={cy} r="9" fill="rgba(255,60,60,.25)" />
        <circle cx={cx} cy={cy} r="4.5" fill="#ff3b3b" stroke="#fff" strokeWidth="1.2" />
      </svg>
    </div>
  );
};
