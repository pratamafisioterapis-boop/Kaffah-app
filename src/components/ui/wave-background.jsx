import React from 'react';

/**
 * Soft light-blue wave accents for the bottom edge of a panel. Render inside
 * a `relative overflow-hidden` container as the first child, then wrap the
 * real content in a `relative z-10` wrapper so it sits above the waves.
 */
const WaveBackground = () => (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden" aria-hidden="true">
    <svg
      className="w-full h-24 sm:h-32 text-blue-50"
      viewBox="0 0 1440 220"
      preserveAspectRatio="none"
      fill="currentColor"
    >
      <path d="M0,140 C240,200 480,80 720,110 C960,140 1200,220 1440,150 L1440,220 L0,220 Z" />
    </svg>
    <svg
      className="w-full h-20 sm:h-28 text-blue-100/70 -mt-14 sm:-mt-20"
      viewBox="0 0 1440 220"
      preserveAspectRatio="none"
      fill="currentColor"
    >
      <path d="M0,170 C300,110 600,190 900,150 C1140,120 1320,170 1440,140 L1440,220 L0,220 Z" />
    </svg>
  </div>
);

export default WaveBackground;
