// "Mode Beban Ringan" — a per-admin-account, display-only view filter.
//
// When an admin switches it on (Setup Akun), every read that admin makes of
// appointments / daily_recaps / package_tracking is trimmed on the client so
// each therapist shows only 0-2 patients per *past* day. Today and future
// dates are never touched. Nothing is written to or deleted from the
// database: other accounts (owner, therapists, other admins) keep seeing the
// real data, and money tables (accounting, income, invoices, payments) are
// not filtered at all.
//
// Mechanics: a custom `fetch` handed to the Supabase client (see
// customSupabaseClient.js) post-filters PostgREST responses for the three
// tables above, so dashboards, lists, calendars and counters all agree
// without touching each call site. Which rows survive is deterministic
// (hash based), so the same view comes back on every refresh.

const STORAGE_PREFIX = 'kaffah-light-load-mode:';
const PAGE_SIZE = 1000;
const FILTERED_TABLES = ['daily_recaps', 'appointments', 'package_tracking'];

const state = {
  enabled: false,
  ready: false,
  userId: null,
  hidden: new Set(), // `${table}:${id}` of rows to hide
  pkgHidden: new Map(), // package_tracking id -> number of hidden linked recaps
};

const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });

export const subscribeLightLoadMode = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// Today in the clinic's timezone (WIB), as YYYY-MM-DD.
const todayStr = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

// Small stable string hash (FNV-1a) -> unsigned 32-bit int.
const hash = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// Per therapist-day cap: ~15% of days 0 patients, ~40% 1, ~45% 2.
const capFor = (therapistKey, date) => {
  const r = hash(`cap|${therapistKey}|${date}`) % 100;
  if (r < 15) return 0;
  if (r < 55) return 1;
  return 2;
};

const readStored = (userId) => {
  try { return window.localStorage.getItem(STORAGE_PREFIX + userId) === '1'; } catch { return false; }
};

export const isLightLoadModeEnabled = () => state.enabled;
export const isLightLoadModeReady = () => state.ready;

let rawFetch = (...args) => window.fetch(...args);
let getAuth = async () => null; // () => ({ accessToken, apikey, baseUrl })

export const configureLightLoadMode = ({ fetchImpl, authProvider }) => {
  if (fetchImpl) rawFetch = fetchImpl;
  if (authProvider) getAuth = authProvider;
};

const fetchAllRaw = async (table, select, extraParams) => {
  const auth = await getAuth();
  if (!auth) return [];
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const url = `${auth.baseUrl}/rest/v1/${table}?select=${select}${extraParams}`;
    // eslint-disable-next-line no-await-in-loop
    const res = await rawFetch(url, {
      headers: {
        apikey: auth.apikey,
        Authorization: `Bearer ${auth.accessToken}`,
        'Range-Unit': 'items',
        Range: `${from}-${from + PAGE_SIZE - 1}`,
      },
    });
    if (!res.ok) throw new Error(`light-load prefetch ${table} failed (${res.status})`);
    // eslint-disable-next-line no-await-in-loop
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
};

// Works out which past rows to hide. Patients are the unit of selection per
// therapist-day, and the same choice is shared by recaps and appointments so
// both views tell the same story.
const computeHidden = async (clinicId) => {
  const today = todayStr();
  const clinicParam = clinicId ? `&clinic_id=eq.${clinicId}` : '';
  const [recaps, appts] = await Promise.all([
    fetchAllRaw('daily_recaps', 'id,therapist_id,patient_id,recap_date,package_tracking_id', `${clinicParam}&recap_date=lt.${today}`),
    fetchAllRaw('appointments', 'id,physiotherapist_id,patient_id,appointment_date', `${clinicParam}&appointment_date=lt.${today}`),
  ]);

  const entries = [];
  recaps.forEach((r) => entries.push({
    table: 'daily_recaps', id: r.id, t: r.therapist_id || 'none',
    d: String(r.recap_date || '').slice(0, 10), p: r.patient_id || `row:${r.id}`, pkg: r.package_tracking_id,
  }));
  appts.forEach((a) => entries.push({
    table: 'appointments', id: a.id, t: a.physiotherapist_id || 'none',
    d: String(a.appointment_date || '').slice(0, 10), p: a.patient_id || `row:${a.id}`,
  }));

  const groups = new Map(); // `${t}|${d}` -> Set(patient keys)
  entries.forEach((e) => {
    if (!e.d || e.d >= today) return;
    const k = `${e.t}|${e.d}`;
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(e.p);
  });

  const kept = new Set(); // `${t}|${d}|${p}`
  groups.forEach((patients, k) => {
    const [t, d] = k.split('|');
    const cap = capFor(t, d);
    [...patients]
      .sort((a, b) => hash(`${a}|${k}`) - hash(`${b}|${k}`))
      .slice(0, cap)
      .forEach((p) => kept.add(`${k}|${p}`));
  });

  const hidden = new Set();
  const pkgHidden = new Map();
  entries.forEach((e) => {
    if (!e.d || e.d >= today) return;
    if (kept.has(`${e.t}|${e.d}|${e.p}`)) return;
    hidden.add(`${e.table}:${e.id}`);
    if (e.table === 'daily_recaps' && e.pkg) pkgHidden.set(e.pkg, (pkgHidden.get(e.pkg) || 0) + 1);
  });
  return { hidden, pkgHidden };
};

let refreshToken = 0;
export const refreshLightLoadMode = async (clinicId) => {
  const token = ++refreshToken;
  if (!state.enabled) return;
  try {
    const { hidden, pkgHidden } = await computeHidden(clinicId);
    if (token !== refreshToken || !state.enabled) return;
    state.hidden = hidden;
    state.pkgHidden = pkgHidden;
    state.ready = true;
  } catch (err) {
    // Fail open: if we can't work out the view, show real data.
    console.error('[lightLoadMode] refresh failed', err);
    state.ready = false;
  }
  notify();
};

// Called when the logged-in account is known (or changes). Only admins can
// ever have the mode active.
export const initLightLoadMode = async ({ userId, role, clinicId }) => {
  state.userId = userId || null;
  const allowed = !!userId && role === 'admin';
  state.enabled = allowed && readStored(userId);
  state.ready = false;
  state.hidden = new Set();
  state.pkgHidden = new Map();
  if (state.enabled) await refreshLightLoadMode(clinicId);
  else notify();
};

export const setLightLoadModeEnabled = async ({ userId, clinicId, enabled }) => {
  try { window.localStorage.setItem(STORAGE_PREFIX + userId, enabled ? '1' : '0'); } catch { /* ignore */ }
  state.userId = userId;
  state.enabled = enabled;
  state.ready = false;
  state.hidden = new Set();
  state.pkgHidden = new Map();
  if (enabled) await refreshLightLoadMode(clinicId);
  else notify();
};

export const getStoredLightLoadMode = (userId) => (userId ? readStored(userId) : false);

// ---- fetch interception -------------------------------------------------

const splitTopLevel = (s) => {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
};

// Makes sure `id` is selected so rows can be matched; returns true if added.
const ensureIdSelected = (url) => {
  const sel = url.searchParams.get('select');
  if (sel === null || sel === '*') return false;
  const cols = splitTopLevel(sel).map((c) => c.trim());
  if (cols.some((c) => c === 'id' || c === '*' || /^[a-z_]+:id$/.test(c))) return false;
  url.searchParams.set('select', `${sel},id`);
  return true;
};

const tableOf = (url) => {
  const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/);
  return m && FILTERED_TABLES.includes(m[1]) ? m[1] : null;
};

const headerOf = (init, input, name) => {
  const h = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
  return h.get(name);
};

const adjustPackage = (row) => {
  const n = state.pkgHidden.get(row.id);
  if (!n) return row;
  const next = { ...row };
  if (typeof next.sessions_used === 'number') next.sessions_used = Math.max(0, next.sessions_used - n);
  if (typeof next.sessions_remaining === 'number') next.sessions_remaining += n;
  return next;
};

export const lightLoadFetch = async (input, init) => {
  const passthrough = () => rawFetch(input, init);
  if (!state.enabled || !state.ready) return passthrough();

  const method = ((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return passthrough();

  let url;
  try { url = new URL(typeof input === 'string' ? input : input.url); } catch { return passthrough(); }
  const table = tableOf(url);
  if (!table) return passthrough();

  const accept = headerOf(init, input, 'Accept') || '';
  if (accept.includes('vnd.pgrst.object')) return passthrough(); // single-row lookups stay real

  // Count-only query (select(..., { head: true, count })): re-run it as a
  // paged id listing so hidden rows can be excluded from the number.
  if (method === 'HEAD') {
    if (table === 'package_tracking') return passthrough();
    const auth = await getAuth();
    if (!auth) return passthrough();
    const listUrl = new URL(url.toString());
    listUrl.searchParams.set('select', 'id');
    let visible = 0;
    for (let from = 0; ; from += PAGE_SIZE) {
      // eslint-disable-next-line no-await-in-loop
      const res = await rawFetch(listUrl.toString(), {
        headers: {
          apikey: auth.apikey,
          Authorization: `Bearer ${auth.accessToken}`,
          'Range-Unit': 'items',
          Range: `${from}-${from + PAGE_SIZE - 1}`,
        },
      });
      if (!res.ok) return passthrough();
      // eslint-disable-next-line no-await-in-loop
      const page = await res.json();
      visible += page.filter((r) => !state.hidden.has(`${table}:${r.id}`)).length;
      if (page.length < PAGE_SIZE) break;
    }
    return new Response(null, { status: 200, headers: { 'content-range': `*/${visible}` } });
  }

  const addedId = table !== 'package_tracking' && ensureIdSelected(url);
  const res = await rawFetch(url.toString(), init);
  if (!res.ok) return res;
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) return res;

  let body;
  try { body = await res.clone().json(); } catch { return res; }
  if (!Array.isArray(body)) return res;

  let rows;
  if (table === 'package_tracking') {
    rows = body.map(adjustPackage);
  } else {
    rows = body.filter((r) => !state.hidden.has(`${table}:${r.id}`));
    if (addedId) rows = rows.map(({ id, ...rest }) => rest); // eslint-disable-line no-unused-vars
  }

  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  const range = headers.get('content-range');
  const removed = body.length - rows.length;
  if (removed && range) {
    const m = range.match(/^(.*)\/(\d+)$/);
    if (m) headers.set('content-range', `${m[1]}/${Math.max(0, Number(m[2]) - removed)}`);
  }
  return new Response(JSON.stringify(rows), { status: res.status, statusText: res.statusText, headers });
};
