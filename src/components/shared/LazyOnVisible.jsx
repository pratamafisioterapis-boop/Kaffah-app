import React, { Suspense, useEffect, useRef, useState } from 'react';

// Menunda render (dan fetch data) widget yang ada di bawah layar sampai hampir terlihat.
// Dipakai untuk grafik dashboard: tanpa ini semua grafik langsung memanggil Supabase saat
// halaman dibuka, termasuk yang tidak pernah di-scroll pengguna.
// `className` dipakai untuk placeholder supaya posisi di grid (col-span) tetap sama.
const LazyOnVisible = ({ children, className, minHeight = 260, rootMargin = '400px' }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined'
  );

  useEffect(() => {
    if (visible) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  const placeholder = (
    <div ref={ref} className={className} style={{ minHeight }} aria-hidden="true" />
  );
  if (!visible) return placeholder;
  return <Suspense fallback={<div className={className} style={{ minHeight }} aria-hidden="true" />}>{children}</Suspense>;
};

export default LazyOnVisible;
