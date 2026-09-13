// Tiny in-memory, module-level cache used to make menu switching feel instant.
//
// The app renders each menu (Appointment, Database Pasien, ...) as a
// react-router <Route>, so React fully unmounts a page's component tree the
// moment you navigate away and remounts it from scratch when you come back.
// Without this cache, every remount re-ran its data fetch from zero and blanked
// the screen behind a spinner while it waited on the network - even though the
// same data had just been fetched seconds earlier.
//
// This cache lets a page show its last known data immediately on remount
// (no spinner) while it quietly revalidates in the background, so switching
// menus back and forth stays instant instead of re-paying a network round trip
// every time.
const store = new Map();

export const getCachedData = (key) => store.get(key)?.data ?? null;

export const hasCachedData = (key) => store.has(key);

export const setCachedData = (key, data) => {
  store.set(key, { data, timestamp: Date.now() });
};

export const clearCachedData = (keyPrefix) => {
  if (!keyPrefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
};
