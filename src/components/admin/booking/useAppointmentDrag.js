import { useCallback, useEffect, useRef, useState } from 'react';

// Drag & drop reschedule untuk kartu "Slot Terisi".
//
// Kenapa pointer events (bukan HTML5 DnD): HTML5 DnD tidak jalan di layar sentuh
// dan tidak bisa auto-scroll dengan baik. Di sini mouse langsung mulai menyeret
// setelah bergeser beberapa piksel, sedangkan layar sentuh butuh tekan lama agar
// tidak bentrok dengan scroll.
//
// Target drop dikenali lewat atribut DOM:
//   [data-drop-slot]  + data-drop-therapist, data-drop-time, data-drop-label, data-therapist-name
//   [data-drop-day]   (tanggal yyyy-MM-dd pada strip hari)
//   [data-drag-header] dipakai sebagai batas atas zona auto-scroll
const THRESHOLD_PX = 5;
const LONG_PRESS_MS = 230;
const SCROLL_ZONE_PX = 80;
const SCROLL_MAX_SPEED = 20;

const preventDefault = (e) => {
  if (e.cancelable) e.preventDefault();
};

const getScrollParent = (node) => {
  let el = node?.parentElement;
  while (el && el !== document.body) {
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null; // pakai scroll window
};

export function useAppointmentDrag({ enabled = true, onDropOnSlot, onDropOnDay }) {
  const [dragApp, setDragApp] = useState(null);
  const stateRef = useRef(null);
  const ghostRef = useRef(null);
  const callbacksRef = useRef({});
  callbacksRef.current = { onDropOnSlot, onDropOnDay };
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const justDraggedRef = useRef(false);

  const placeGhost = () => {
    const d = stateRef.current;
    const g = ghostRef.current;
    if (!d || !g) return;
    g.style.transform = `translate3d(${d.x - d.offX}px, ${d.y - d.offY}px, 0) rotate(1.5deg)`;
  };

  const setGhostNode = useCallback((node) => {
    ghostRef.current = node;
    placeGhost();
  }, []);

  const updateTip = (target) => {
    const tip = ghostRef.current?.querySelector('[data-ghost-tip]');
    if (!tip) return;
    if (target?.hasAttribute('data-drop-slot')) {
      tip.dataset.ok = 'true';
      tip.textContent = `${target.dataset.therapistName || ''} · ${target.dataset.dropLabel || ''}`;
    } else if (target?.hasAttribute('data-drop-day')) {
      tip.dataset.ok = 'false';
      tip.textContent = 'Lepas untuk pilih jam';
    } else {
      tip.dataset.ok = 'false';
      tip.textContent = 'Lepas di slot hijau atau di sebuah hari';
    }
  };

  const hitTest = () => {
    const d = stateRef.current;
    if (!d || !d.started) return;
    const el = document.elementFromPoint(d.x, d.y);
    const target = el?.closest('[data-drop-slot]') || el?.closest('[data-drop-day]') || null;
    if (target === d.over) return;
    if (d.over) d.over.removeAttribute('data-drop-over');
    if (target) target.setAttribute('data-drop-over', 'true');
    d.over = target;
    updateTip(target);
  };

  const autoScrollLoop = () => {
    const d = stateRef.current;
    if (!d || !d.started) return;
    const scroller = d.scroller;
    const bounds = scroller
      ? scroller.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const headerBottom = document.querySelector('[data-drag-header]')?.getBoundingClientRect().bottom ?? bounds.top;
    const guardTop = Math.max(bounds.top, headerBottom);

    let v = 0;
    if (d.y > bounds.bottom - SCROLL_ZONE_PX) {
      v = ((d.y - (bounds.bottom - SCROLL_ZONE_PX)) / SCROLL_ZONE_PX) * SCROLL_MAX_SPEED;
    } else if (d.y > guardTop && d.y < guardTop + SCROLL_ZONE_PX) {
      v = -((guardTop + SCROLL_ZONE_PX - d.y) / SCROLL_ZONE_PX) * SCROLL_MAX_SPEED;
    }
    if (v) {
      if (scroller) scroller.scrollBy(0, v);
      else window.scrollBy(0, v);
      hitTest();
    }
    d.raf = requestAnimationFrame(autoScrollLoop);
  };

  const teardown = () => {
    const d = stateRef.current;
    if (!d) return;
    clearTimeout(d.longPressTimer);
    cancelAnimationFrame(d.raf);
    d.rowEl?.removeEventListener('touchmove', preventDefault);
    document.removeEventListener('touchmove', preventDefault);
    if (d.over) d.over.removeAttribute('data-drop-over');
    if (d.started) {
      document.body.style.cursor = d.prevCursor || '';
      document.body.style.userSelect = d.prevUserSelect || '';
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 60);
    }
    stateRef.current = null;
    setDragApp(null);
  };

  const startDrag = () => {
    const d = stateRef.current;
    if (!d || d.started) return;
    d.started = true;
    d.scroller = getScrollParent(d.rowEl);
    d.prevCursor = document.body.style.cursor;
    d.prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    // Listener dipasang langsung di elemen sumber agar tetap menerima touchmove
    // walau React sempat melepas elemen itu dari DOM (mis. saat ganti hari).
    d.rowEl?.addEventListener('touchmove', preventDefault, { passive: false });
    document.addEventListener('touchmove', preventDefault, { passive: false });
    setDragApp(d.app);
    d.raf = requestAnimationFrame(autoScrollLoop);
  };

  const finish = () => {
    const d = stateRef.current;
    if (!d) return;
    const el = document.elementFromPoint(d.x, d.y);
    const slot = el?.closest('[data-drop-slot]');
    const day = el?.closest('[data-drop-day]');
    const app = d.app;
    const slotData = slot
      ? { therapistId: slot.dataset.dropTherapist, time: slot.dataset.dropTime }
      : null;
    const dayKey = day ? day.dataset.dropDay : null;
    teardown();
    if (slotData) callbacksRef.current.onDropOnSlot?.(app, slotData);
    else if (dayKey) callbacksRef.current.onDropOnDay?.(app, dayKey);
  };

  // Dipanggil dari onPointerDown baris appointment di kartu terapis.
  const onAppointmentPointerDown = useCallback((e, app) => {
    if (!enabledRef.current || stateRef.current || e.button > 0) return;
    const rowEl = e.currentTarget;
    const rect = rowEl.getBoundingClientRect();
    const isTouch = e.pointerType === 'touch';
    stateRef.current = {
      app,
      rowEl,
      pointerId: e.pointerId,
      isTouch,
      sx: e.clientX,
      sy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offX: Math.min(Math.max(e.clientX - rect.left, 20), 240),
      offY: Math.min(Math.max(e.clientY - rect.top, 0), 40),
      started: false,
      ready: !isTouch,
      over: null,
      raf: 0,
      longPressTimer: 0,
    };
    try { e.target.releasePointerCapture?.(e.pointerId); } catch (_) { /* abaikan */ }
    if (isTouch) {
      stateRef.current.longPressTimer = setTimeout(() => {
        const d = stateRef.current;
        if (!d || d.started) return;
        d.ready = true;
        startDrag();
        placeGhost();
        hitTest();
        try { navigator.vibrate?.(10); } catch (_) { /* abaikan */ }
      }, LONG_PRESS_MS);
    }
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const d = stateRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.started) {
        const dist = Math.hypot(d.x - d.sx, d.y - d.sy);
        if (d.isTouch && !d.ready) {
          // Jari bergeser sebelum tekan lama selesai: itu scroll biasa.
          if (dist > 10) {
            clearTimeout(d.longPressTimer);
            stateRef.current = null;
          }
          return;
        }
        if (dist > THRESHOLD_PX) startDrag();
        else return;
      }
      placeGhost();
      hitTest();
    };
    const onUp = (e) => {
      const d = stateRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.started) {
        clearTimeout(d.longPressTimer);
        stateRef.current = null;
        return;
      }
      finish();
    };
    const onCancel = (e) => {
      const d = stateRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.started) {
        clearTimeout(d.longPressTimer);
        stateRef.current = null;
        return;
      }
      teardown();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && stateRef.current?.started) teardown();
    };
    // Setelah drag, klik yang menyusul (mis. pada nama pasien) tidak boleh diproses.
    const onClickCapture = (e) => {
      if (justDraggedRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const onContextMenu = (e) => {
      if (stateRef.current?.isTouch) e.preventDefault();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClickCapture, true);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('contextmenu', onContextMenu);
      teardown();
    };
  }, []);

  return { dragApp, onAppointmentPointerDown, setGhostNode };
}
