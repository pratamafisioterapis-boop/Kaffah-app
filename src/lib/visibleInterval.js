// setInterval yang tidak menembak query saat tab tersembunyi (dashboard dibiarkan terbuka
// di tab latar atau layar HP mati). Kalau ada tick yang terlewat, jalankan sekali begitu
// tab terlihat lagi supaya data tidak basi. Mengembalikan fungsi pembersih.
export const visibleInterval = (fn, ms) => {
  let missed = false;
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const id = setInterval(() => {
    if (hidden()) { missed = true; return; }
    fn();
  }, ms);
  const onVisible = () => {
    if (missed && !hidden()) { missed = false; fn(); }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(id);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
  };
};
