import React, { useEffect, useRef, useState } from 'react';

// Menunda render (dan pengambilan data) sebuah blok sampai ia mendekati layar.
// Widget di bagian bawah dashboard tidak ikut berebut koneksi saat halaman
// pertama dibuka; begitu terlihat/hampir terlihat, ia dimuat dan tetap terpasang.
const LazyMount = ({ children, className, minHeight = 240, rootMargin = '400px' }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
};

export default LazyMount;
