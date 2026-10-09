import React from 'react';

// Placeholder shown while a lazily loaded page chunk downloads. Mirrors the page
// rhythm (header plate, a toolbar row, content cards) so the layout does not jump
// when the real page appears, and reads as "loading" faster than a bare spinner.
const Block = ({ className = '' }) => (
  <div className={`rounded-app-lg bg-slate-200/70 motion-safe:animate-pulse ${className}`} />
);

const PageSkeleton = () => (
  <div role="status" aria-busy="true" aria-label="Memuat halaman" className="space-y-4">
    <Block className="h-24 sm:h-28 bg-app-soft" />
    <div className="flex gap-2">
      <Block className="h-9 w-28 !rounded-app-sm" />
      <Block className="h-9 w-24 !rounded-app-sm" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Block className="h-40" />
      <Block className="h-40" />
    </div>
    <Block className="h-56" />
    <span className="sr-only">Memuat halaman…</span>
  </div>
);

export default PageSkeleton;
