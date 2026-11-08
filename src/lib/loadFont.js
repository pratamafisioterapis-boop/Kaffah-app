// Memuat stylesheet Google Fonts tanpa memblokir render. Berbeda dengan
// `@import` di CSS (yang membuat rantai CSS -> CSS font di jalur kritis untuk
// semua pengunjung), font ini hanya diminta saat komponen yang memakainya mount.
export const loadFontStylesheet = (id, href) => {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  link.media = 'print';
  link.onload = () => { link.media = 'all'; };
  document.head.appendChild(link);
};
