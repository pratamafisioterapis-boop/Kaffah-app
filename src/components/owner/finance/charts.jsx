import React from 'react';
import { cn } from '@/lib/utils';

// Cincin progres (0-100). Isi tengah diberikan lewat children.
export const Ring = ({ pct = 0, color = '#059669', className, children }) => {
  const C = 2 * Math.PI * 48;
  const dash = (Math.min(Math.abs(pct), 100) / 100) * C;
  return (
    <div className={cn('relative aspect-square', className)}>
      <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
        <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`} transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray .5s cubic-bezier(.23,1,.32,1), stroke .3s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

// Sparkline dengan area & titik akhir.
export const Spark = ({ values = [], color = '#059669', className, label = 'Tren' }) => {
  if (values.length < 2) return null;
  const w = 200, h = 44, pad = 4;
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - ((v - mn) / rng) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0]} ${h}L${pts[0][0]} ${h}Z`;
  const end = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('w-full h-auto block overflow-visible', className)} role="img" aria-label={label}>
      <path d={area} fill={color} opacity="0.14" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={end[0]} cy={end[1]} r="3.6" fill={color} />
    </svg>
  );
};

// Donut interaktif. items: [{ key, value, color }]. Klik segmen -> onSelect(key).
export const Donut = ({ items, selected, onSelect, className, children }) => {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const C = 2 * Math.PI * 42;
  let offset = 0;
  return (
    <div className={cn('relative aspect-square', className)}>
      <svg viewBox="0 0 120 120" className="w-full h-full">
        {items.map((it) => {
          const len = (it.value / total) * C;
          const el = (
            <circle
              key={it.key} cx="60" cy="60" r="42" fill="none" stroke={it.color}
              strokeWidth={selected === it.key ? 21 : 16}
              opacity={selected && selected !== it.key ? 0.25 : 1}
              strokeDasharray={`${Math.max(len - 2, 1)} ${C}`} strokeDashoffset={-offset}
              transform="rotate(-90 60 60)" className="cursor-pointer"
              style={{ transition: 'opacity .2s, stroke-width .2s' }}
              onClick={() => onSelect?.(selected === it.key ? null : it.key)}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">{children}</div>
    </div>
  );
};
