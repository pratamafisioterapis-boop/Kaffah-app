// Promise-based replacement for window.confirm(), rendered by <ConfirmHost /> as an
// AlertDialog so confirmations match the app's design (and theme) instead of the
// browser's native box. Usage: `if (!(await confirmAction('Hapus data ini?'))) return;`
// Falls back to the native dialog if the host isn't mounted yet.
let listener = null;

export const subscribeConfirm = (fn) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};

export const confirmAction = (message, options = {}) =>
  new Promise((resolve) => {
    if (!listener) {
      resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
      return;
    }
    listener({ message, options, resolve });
  });
