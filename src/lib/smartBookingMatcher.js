import { addDays, startOfDay, isSameDay, format } from 'date-fns';
import { getAvailableSlots } from '@/lib/api';
import { TIME_WINDOWS } from '@/lib/complaintTags';

const MAX_DATES_TO_SCAN = 14;
const ROLLING_WEEK_DAYS = 7;
// A slot can't be recommended/booked once it's less than this many minutes away.
const MIN_LEAD_MINUTES = 30;
// Cap how many result cards a single date can contribute, so the list spreads
// across several dates in the range instead of one date filling every slot.
const MAX_RESULTS_PER_DATE = 2;

/**
 * Builds the ordered list of candidate dates to search, based on the
 * patient's "kapan" (when) preference.
 */
export function buildCandidateDates(whenId, customDate) {
  const today = startOfDay(new Date());

  if (whenId === 'tomorrow') {
    const tomorrow = addDays(today, 1);
    return Array.from({ length: MAX_DATES_TO_SCAN }, (_, i) => addDays(tomorrow, i));
  }

  if (whenId === 'this_week') {
    // Rolling 7-day window from today — not "until the end of the calendar
    // week" — so a request made on a Friday still searches a full week out.
    return Array.from({ length: ROLLING_WEEK_DAYS }, (_, i) => addDays(today, i));
  }

  if (whenId === 'custom' && customDate) {
    const base = startOfDay(customDate);
    return Array.from({ length: MAX_DATES_TO_SCAN }, (_, i) => addDays(base, i));
  }

  // 'asap' (default)
  return Array.from({ length: MAX_DATES_TO_SCAN }, (_, i) => addDays(today, i));
}

/**
 * Orders time windows starting from the requested one, then outward by
 * distance — so a "malam" request that's fully booked falls back to "sore"
 * before jumping further away.
 */
export function orderedWindows(preferredId) {
  const idx = TIME_WINDOWS.findIndex(w => w.id === preferredId);
  if (idx === -1) return TIME_WINDOWS;
  return [...TIME_WINDOWS].sort((a, b) => {
    const da = Math.abs(TIME_WINDOWS.findIndex(w => w.id === a.id) - idx);
    const db = Math.abs(TIME_WINDOWS.findIndex(w => w.id === b.id) - idx);
    return da - db;
  });
}

/**
 * Ranks active/bookable therapists by how many of the patient's selected
 * complaint tags they specialize in. Falls back to the full list (unranked)
 * if no therapist has been tagged for any of the selected complaints yet —
 * the patient should never be left with zero options just because the
 * clinic hasn't finished tagging its therapists.
 *
 * Therapists who previously treated this patient (preferredTherapistIds, from
 * their appointment history) get a large score bonus so they're recommended
 * first — continuity of care matters more than a specialization tag match.
 */
export function rankTherapistsByComplaint(therapists, selectedSlugs, preferredTherapistIds = []) {
  const preferredSet = new Set(preferredTherapistIds);
  const hasPreferred = preferredSet.size > 0;

  if ((!selectedSlugs || selectedSlugs.length === 0) && !hasPreferred) return therapists;

  const scored = therapists.map(t => {
    const tags = Array.isArray(t.complaint_tags) ? t.complaint_tags : [];
    const matchCount = (selectedSlugs || []).filter(tag => tags.includes(tag)).length;
    const preferredBonus = preferredSet.has(t.id) ? 1000 : 0;
    return { therapist: t, score: matchCount + preferredBonus };
  });

  const matched = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  if (matched.length > 0) return matched.map(s => s.therapist);

  return therapists;
}

const getActiveSlotsForDate = async (date, rankedIds, now) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: slots } = await getAvailableSlots(dateStr, null);
  if (!slots || slots.length === 0) return [];

  let activeSlots = slots.filter(s => s.status === 'aktif' && rankedIds.has(s.therapist_id));

  // Don't recommend a slot that's about to start (or already passed) —
  // patients need at least MIN_LEAD_MINUTES to arrive/prepare.
  if (isSameDay(date, now)) {
    activeSlots = activeSlots.filter(s => {
      const [h, m] = (s.slot_start || '').split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return false;
      const slotDateTime = new Date(date);
      slotDateTime.setHours(h, m, 0, 0);
      return (slotDateTime.getTime() - now.getTime()) >= MIN_LEAD_MINUTES * 60 * 1000;
    });
  }

  return activeSlots;
};

// "tomorrow" and "custom" pin the search to one specific date the patient
// actually asked for — unlike "asap" (soonest available) or "this_week" (a
// whole range), those two should not silently spread across other days.
const PINNED_DATE_WHEN_IDS = new Set(['tomorrow', 'custom']);

const buildResultsForWindow = (rankedTherapists, preferredSet, date, win, activeSlots, windowId, isExactDate) => {
  const inWindow = activeSlots.filter(s => {
    const start = (s.slot_start || '').slice(0, 5);
    return start >= win.start && start < win.end;
  });
  if (inWindow.length === 0) return [];

  const byTherapist = {};
  inWindow.forEach(s => {
    if (!byTherapist[s.therapist_id]) byTherapist[s.therapist_id] = [];
    byTherapist[s.therapist_id].push(s);
  });

  const isExactWindow = win.id === windowId;

  return rankedTherapists
    .filter(t => byTherapist[t.id])
    .map(t => ({
      therapist: t,
      date,
      window: win,
      slots: byTherapist[t.id].sort((a, b) => a.slot_start.localeCompare(b.slot_start)).slice(0, 4),
      isPreferred: preferredSet.has(t.id),
      isExactDate,
      isExactWindow,
      isExactMatch: isExactDate && isExactWindow
    }));
};

/**
 * Core Smart Booking search: given a ranked therapist pool and a time
 * preference, finds available slots for the patient.
 *
 * "Besok" and "Tanggal Khusus" pin the search to that one specific date —
 * the patient asked for a date, not a range, so results only spread to
 * other days once that exact date has nothing left to offer. "Secepatnya"
 * and "Dalam Seminggu Ini" have no single pinned date, so they search
 * across their whole range from the start.
 *
 * Within whatever date(s) are in play, it looks for the exact requested
 * window first (so "Malam" stays "Malam"), and only widens into nearby
 * windows if the exact window is empty everywhere it looked.
 *
 * Returns { results, scannedDates, exactMatch, dateShifted } where each
 * result is { therapist, date, window, slots, isExactDate, isExactWindow,
 * isExactMatch }. `exactMatch` means the first result matches both the
 * requested date and window; `dateShifted` means it matches the window but
 * had to move to a different date than the one pinned.
 */
export async function findSmartRecommendations({
  therapists,
  complaintSlugs,
  whenId,
  customDate,
  windowId,
  preferredTherapistIds = [],
  maxResults = 6
}) {
  // Guard against duplicate therapist rows (e.g. a data glitch upstream) —
  // otherwise the same therapist can be ranked twice and show up as two
  // identical result cards for the same date/slot.
  const dedupedTherapists = Array.from(
    new Map(therapists.filter(t => t?.id).map(t => [t.id, t])).values()
  );

  const rankedTherapists = rankTherapistsByComplaint(dedupedTherapists, complaintSlugs, preferredTherapistIds);
  const rankedIds = new Set(rankedTherapists.map(t => t.id));
  const preferredSet = new Set(preferredTherapistIds);
  const candidateDates = buildCandidateDates(whenId, customDate);
  const preferredWindow = TIME_WINDOWS.find(w => w.id === windowId) || null;
  const now = new Date();
  const pinnedDate = PINNED_DATE_WHEN_IDS.has(whenId) ? candidateDates[0] : null;
  const isPinnedDate = (date) => (pinnedDate ? isSameDay(date, pinnedDate) : true);

  let results = [];
  let scannedDates = 0;
  const slotsByDate = new Map();

  const fetchAndCache = async (date) => {
    const key = date.toDateString();
    if (!slotsByDate.has(key)) {
      // eslint-disable-next-line no-await-in-loop
      slotsByDate.set(key, await getActiveSlotsForDate(date, rankedIds, now));
    }
    return slotsByDate.get(key);
  };

  // Phase 1a: pinned date only, exact window — the patient's literal request.
  if (pinnedDate && preferredWindow) {
    scannedDates += 1;
    const activeSlots = await fetchAndCache(pinnedDate);
    if (activeSlots.length > 0) {
      results.push(...buildResultsForWindow(rankedTherapists, preferredSet, pinnedDate, preferredWindow, activeSlots, windowId, true));
    }
  }

  // Phase 1b: exact window, other dates — only runs for range searches
  // (no pinned date), or as a fallback once the pinned date came up empty.
  if (results.length === 0 && preferredWindow) {
    for (const date of candidateDates) {
      if (pinnedDate && isSameDay(date, pinnedDate)) continue; // already checked in phase 1a
      scannedDates += 1;
      const activeSlots = await fetchAndCache(date); // eslint-disable-line no-await-in-loop
      if (activeSlots.length === 0) continue;
      const dateResults = buildResultsForWindow(rankedTherapists, preferredSet, date, preferredWindow, activeSlots, windowId, isPinnedDate(date));
      results.push(...dateResults.slice(0, MAX_RESULTS_PER_DATE));
      if (results.length >= maxResults) break;
    }
  }

  // Phase 2: fall back to widening into nearby windows — only runs if the
  // exact window came up completely empty for every date scanned above.
  // Still checks the pinned date first, so a date-correct alternative
  // window beats jumping to another day entirely.
  if (results.length === 0) {
    const windowsOrder = orderedWindows(windowId);
    const datesForFallback = pinnedDate
      ? [pinnedDate, ...candidateDates.filter(d => !isSameDay(d, pinnedDate))]
      : candidateDates;

    for (const date of datesForFallback) {
      const activeSlots = await fetchAndCache(date); // eslint-disable-line no-await-in-loop
      if (activeSlots.length === 0) continue;

      for (const win of windowsOrder) {
        const windowResults = buildResultsForWindow(rankedTherapists, preferredSet, date, win, activeSlots, windowId, isPinnedDate(date));
        if (windowResults.length === 0) continue;
        results.push(...windowResults.slice(0, MAX_RESULTS_PER_DATE));
        break; // found a usable window for this date, don't widen further within the same day
      }

      if (results.length >= maxResults) break;
    }
  }

  results = results.slice(0, maxResults);

  return {
    results,
    scannedDates,
    exactMatch: results.length > 0 && results[0].isExactMatch,
    dateShifted: results.length > 0 && !results[0].isExactDate && results[0].isExactWindow
  };
}
