// All per-page hero banner images used across the dashboard (see the
// "Hero Banner" block at the top of each dashboard page). Each page only
// requests its own image on mount, so switching menus for the first time
// in a session used to show a bare/blank banner until that page's image
// downloaded. Warming the browser cache for all of them right after login
// means every hero banner is already cached by the time its page mounts.
const HERO_IMAGES = [
  '/hero/clinara-accounting-hero.webp',
  '/hero/clinara-appointment-hero.webp',
  '/hero/clinara-clinicaldoc-hero.webp',
  '/hero/clinara-feedback-hero.webp',
  '/hero/clinara-followup-hero.webp',
  '/hero/clinara-hero-dashboard.webp',
  '/hero/clinara-medrec-hero.webp',
  '/hero/clinara-owner-hero.webp',
  '/hero/clinara-package-hero.webp',
  '/hero/clinara-patients-hero.webp',
  '/hero/clinara-physio-hero.webp',
  '/hero/clinara-recap-hero.webp',
  '/hero/clinara-setup-hero.webp',
  '/hero/clinara-stock-hero.webp',
];

let preloaded = false;

export function preloadHeroImages(role) {
  if (preloaded || typeof window === 'undefined') return;
  // Therapist pages use a compact header without an illustration, and warming ~14
  // images is wasted data on a data-saver / slow mobile connection.
  if (role === 'therapist') return;
  const connection = navigator.connection;
  if (connection && (connection.saveData || /(^|-)2g$|3g/.test(connection.effectiveType || ''))) return;
  preloaded = true;

  const warm = () => {
    HERO_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 2000 });
  } else {
    setTimeout(warm, 300);
  }
}
