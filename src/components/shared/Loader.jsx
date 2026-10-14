import React from 'react';

// Orbit loader: two counter-rotating arcs, an orbiting dot and a breathing core.
// Sizes: sm (inline/buttons), md (cards/sections), lg (full screen).
const SIZES = { sm: 20, md: 56, lg: 96 };

const Loader = ({ size = 'md', className = '', label = 'Memuat' }) => {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  const border = Math.max(2, Math.round(px / 32));
  const inner = Math.round(px * 0.15);
  const core = Math.round(px * 0.35);
  return (
    <span
      role="status"
      aria-label={label}
      className={`kf-loader ${className}`}
      style={{ width: px, height: px, '--kf-b': `${border}px` }}
    >
      <span className="kf-loader-ring" />
      <span className="kf-loader-arc" />
      <span className="kf-loader-arc kf-loader-arc-b" style={{ inset: inner }} />
      {px >= 40 && <span className="kf-loader-dot" />}
      <span className="kf-loader-core" style={{ inset: `calc(50% - ${core / 2}px)` }} />
    </span>
  );
};

export default Loader;
