import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const DEFAULT_TABLES = ['appointments', 'therapist_time_off'];
const DEBOUNCE_MS = 400;
const POLL_MS = 30 * 1000;
const MIN_GAP_MS = 2000;

/**
 * Menjaga kalender booking selalu sinkron tanpa perlu refresh manual.
 *
 * Realtime saja tidak cukup: websocket bisa putus diam-diam (tab di background,
 * koneksi pindah, laptop sleep) dan event yang terlewat tidak pernah dikirim ulang.
 * Karena itu ada tiga lapis:
 *  1. Realtime postgres_changes (cepat, di-debounce supaya burst event = 1 fetch)
 *  2. Refresh saat tab kembali terlihat / window fokus / koneksi kembali online
 *  3. Polling 30 detik selama tab terlihat sebagai jaring pengaman
 *
 * `onRefresh` disimpan di ref sehingga selalu memanggil versi terbaru (tanpa
 * state basi) dan langganan tidak dibuat ulang setiap tanggal/terapis berubah.
 * Nama channel unik per instance agar komponen kalender yang tampil bersamaan
 * tidak saling menutup channel satu sama lain.
 */
export function useCalendarAutoRefresh(onRefresh, { enabled = true, tables = DEFAULT_TABLES } = {}) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const tablesKey = tables.join(',');

  useEffect(() => {
    if (!enabled) return undefined;

    let timer = null;
    let lastRun = 0;

    const run = () => {
      lastRun = Date.now();
      try {
        const result = refreshRef.current?.();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (_) { /* error ditangani di fetcher masing-masing */ }
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastRun < MIN_GAP_MS) return;
      run();
    };

    const channel = supabase.channel(
      `calendar-sync-${Math.random().toString(36).slice(2)}`
    );
    tablesKey.split(',').forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
    });
    // Setelah reconnect, event yang terlewat harus dikejar.
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') refreshIfVisible();
    });

    const pollId = setInterval(refreshIfVisible, POLL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);

    return () => {
      clearTimeout(timer);
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, tablesKey]);
}

export default useCalendarAutoRefresh;
