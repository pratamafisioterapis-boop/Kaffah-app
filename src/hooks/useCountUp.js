import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Menghitung naik dari nilai tampil terakhir ke `target`. Tanpa animasi bila
// pengguna meminta reduced motion.
const useCountUp = (target, duration = 700) => {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const from = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = target;
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const origin = from.current;
    let raf;
    const step = (now) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const cur = origin + (target - origin) * eased;
      from.current = cur;
      setValue(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
};

export default useCountUp;
