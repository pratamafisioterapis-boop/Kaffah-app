// Splits the app across two production domains: PUBLIC_DOMAIN serves the
// marketing/booking pages, APP_DOMAIN serves everything behind login. Both
// domains point at the same Vercel deployment; these helpers keep visitors
// on the right one without touching anything outside dev/preview hosts.
export const PUBLIC_DOMAIN = 'kaffahphysio.id';
export const APP_DOMAIN = 'clinara.id';

const APP_ONLY_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/owner',
  '/super-admin',
  '/admin',
  '/therapist',
  '/rotasi',
  '/pemilih',
  '/pemilih-dpc',
  '/relawan',
  '/follow-up',
];

const matchesHost = (hostname, domain) =>
  hostname === domain || hostname === `www.${domain}`;

export const isAppOnlyPath = (pathname) =>
  APP_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Paths that render fine on APP_DOMAIN without being login-gated - currently
// just the Clinara product homepage. Kept separate from isAppOnlyPath so the
// public domain's own "/" (the Kaffah clinic landing page) is untouched.
const APP_DOMAIN_MARKETING_PATHS = ['/'];

export const staysOnAppDomain = (pathname) =>
  isAppOnlyPath(pathname) || APP_DOMAIN_MARKETING_PATHS.includes(pathname);

export const isOnAppDomain = (hostname = window.location.hostname) =>
  matchesHost(hostname, APP_DOMAIN);

export const isOnPublicDomain = (hostname = window.location.hostname) =>
  matchesHost(hostname, PUBLIC_DOMAIN);

// Relative on any host that isn't the public production domain (dev, Vercel
// previews, or the app domain itself), so local/preview logins keep working.
export const loginHref = () => {
  if (typeof window === 'undefined') return '/login';
  return isOnPublicDomain() ? `https://${APP_DOMAIN}/login` : '/login';
};
