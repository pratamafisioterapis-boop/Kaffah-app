// CSS primitives (`.p-card`, `.p-btn-primary`, `.p-table`, dst.) shared by
// every screen in the Suara PKS module. Originally these lived only inside
// PemilihLayout's inline <style>, which is fine for pages wrapped by that
// layout — but PemilihDpcApp (the standalone DPC PWA) reuses several of the
// same setup/TPS-input components WITHOUT that layout, so it needs this
// stylesheet injected on its own too. Extracted here once so both stay
// pixel-identical instead of drifting apart as two copies.
export const PEMILIH_SHARED_CSS = `
  :root {
    --p-red: #dc2626;
    --p-red-dark: #991b1b;
    --p-red-light: #fef2f2;
    --p-bg: #f4f5f7;
    --p-card: #ffffff;
    --p-border: #e8e9ec;
    --p-text: #1a1d29;
    --p-text-soft: #6b7280;
    --p-shadow-sm: 0 1px 2px rgba(16,24,40,0.05);
    --p-shadow-md: 0 4px 12px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08);
    --p-shadow-lg: 0 12px 32px rgba(16,24,40,0.10), 0 2px 8px rgba(16,24,40,0.06);
    --p-radius: 16px;
    --p-radius-sm: 10px;
  }
  *, *::before, *::after { box-sizing: border-box; }

  .p-card {
    background: var(--p-card); border-radius: var(--p-radius);
    border: 1px solid var(--p-border); box-shadow: var(--p-shadow-md);
    transition: box-shadow 0.2s;
  }
  .p-card-hover:hover { box-shadow: var(--p-shadow-lg); }

  .p-page-title { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: var(--p-text); letter-spacing: -0.02em; }
  .p-page-subtitle { color: var(--p-text-soft); margin-top: 0; margin-bottom: 26px; font-size: 14px; }

  .p-btn-primary {
    padding: 10px 20px; background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff; border: none; border-radius: 12px; cursor: pointer;
    font-weight: 700; font-size: 13.5px; white-space: nowrap;
    box-shadow: 0 4px 14px rgba(220,38,38,0.3), inset 0 1px 1px rgba(255,255,255,0.15);
    transition: all 0.18s cubic-bezier(.4,0,.2,1);
    display: inline-flex; align-items: center; gap: 7px;
  }
  .p-btn-primary:hover { transform: translateY(-1.5px); box-shadow: 0 8px 20px rgba(220,38,38,0.4); }
  .p-btn-primary:active { transform: translateY(0); }
  .p-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }

  .p-btn-ghost {
    padding: 9px 16px; background: #fff; color: var(--p-text);
    border: 1px solid var(--p-border); border-radius: 11px; cursor: pointer;
    font-weight: 600; font-size: 13px; transition: all 0.16s;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .p-btn-ghost:hover { background: #f9fafb; border-color: #d1d5db; }
  .p-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

  .p-input, .p-select {
    width: 100%; padding: 10px 13px; border-radius: 11px; border: 1.5px solid var(--p-border);
    font-size: 13.5px; color: var(--p-text); background: #fff;
    transition: all 0.16s; font-family: inherit;
  }
  .p-input:focus, .p-select:focus {
    outline: none; border-color: #dc2626; box-shadow: 0 0 0 3.5px rgba(220,38,38,0.1);
  }
  .p-input::placeholder { color: #a1a1aa; }
  .p-input:disabled, .p-select:disabled { background: #f4f5f7; color: #9ca3af; }

  .p-label { font-size: 12px; font-weight: 600; color: #4b5563; margin-bottom: 5px; display: block; }

  .p-badge {
    padding: 4px 11px; border-radius: 999px; font-size: 11px; font-weight: 700;
    display: inline-flex; align-items: center; gap: 4px;
  }

  .p-modal-overlay {
    position: fixed; inset: 0; background: rgba(15,17,23,0.6); backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px;
    animation: p-fade-in 0.15s ease-out;
  }
  .p-modal {
    background: #fff; border-radius: 20px; box-shadow: var(--p-shadow-lg);
    animation: p-scale-in 0.18s cubic-bezier(.4,0,.2,1);
    max-height: 90vh; overflow-y: auto;
  }
  @keyframes p-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes p-scale-in { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }

  .p-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .p-table thead tr { background: #fafafa; border-bottom: 1.5px solid var(--p-border); }
  .p-table th { text-align: left; padding: 12px 14px; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
  .p-table td { padding: 13px 14px; border-bottom: 1px solid #f1f1f3; }
  .p-table tbody tr { transition: background 0.12s; }
  .p-table tbody tr:hover { background: #fafafa; }

  /* Wrapper wajib dipakai di sekeliling <table> agar tabel bisa di-scroll horizontal, bukan mendorong layout melebar di layar HP/PWA */
  .p-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

  /* Batasi tinggi wrapper supaya baris di-scroll VERTIKAL di dalam wrapper itu sendiri (bukan
     ikut men-scroll seluruh halaman) — position:sticky pada header hanya bisa diandalkan lintas
     browser kalau elemen yang scroll adalah wrapper ini sendiri, bukan window/halaman. */
  .p-table-wrap-scroll { max-height: 65vh; overflow-y: auto; }

  /* Bikin baris header ikut ketika isi tabel di-scroll ke bawah, supaya nama kolom tetap terlihat di baris manapun */
  .p-table-sticky-head th { position: sticky; top: 0; z-index: 2; background: #fafafa; }

  /* Pasangan kelas untuk tabel (desktop) vs kartu (mobile) — dipakai bareng supaya
     daftar panjang tidak perlu di-swipe horizontal di layar HP/PWA */
  .p-mobile-only { display: none; }
  .p-desktop-only { display: block; }

  /* Grid yang otomatis menjadi 1 kolom di layar sempit (form & panel berdampingan) */
  .p-grid-collapse { min-width: 0; }
  .p-grid-collapse > * { min-width: 0; }

  .p-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
  .p-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 8px; }
  .p-scrollbar::-webkit-scrollbar-track { background: transparent; }

  @media (max-width: 768px) {
    .p-page-title { font-size: 20px; }
    .p-grid-collapse { grid-template-columns: 1fr !important; }
    .p-modal-overlay { align-items: flex-end; padding: 0; }
    .p-modal { width: 100% !important; max-width: 100% !important; border-radius: 20px 20px 0 0 !important; max-height: 92vh; }
    .p-table th, .p-table td { padding: 10px 11px; font-size: 12.5px; }
    .p-mobile-only { display: block; }
    .p-desktop-only { display: none; }
  }
  @media (display-mode: standalone) {
    .p-modal-overlay { padding-bottom: calc(20px + env(safe-area-inset-bottom,0)); }
  }
`;
