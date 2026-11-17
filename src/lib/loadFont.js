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

// Font yang hanya dipakai sebagian halaman: dimuat saat modul pemakainya dievaluasi,
// bukan lewat index.html (yang membuat SEMUA pengunjung mengunduhnya).
export const CAVEAT_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap';
export const SPLASH_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;800&family=Instrument+Serif:ital@1&family=DM+Sans:wght@500&display=swap';
export const loadCaveatFont = () => loadFontStylesheet('caveat-font', CAVEAT_FONT_HREF);
export const loadSplashFonts = () => loadFontStylesheet('splash-fonts', SPLASH_FONT_HREF);
