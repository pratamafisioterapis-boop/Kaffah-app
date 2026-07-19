import { addDays, startOfDay, endOfWeek, eachDayOfInterval, format } from 'date-fns';
import { getAvailableSlots } from '@/lib/api';
import { TIME_WINDOWS } from '@/lib/complaintTags';

const MAX_DATES_TO_SCAN = 14;
const EXTRA_DAYS_IF_WEEK_EXHAUSTED = 10;

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
    const endWeek = endOfWeek(today, { weekStartsOn: 0 }); // 0 = Minggu, matches app convention
    const daysThisWeek = eachDayOfInterval({ start: today, end: endWeek });
    const extra = Array.from({ length: EXTRA_DAYS_IF_WEEK_EXHAUSTED }, (_, i) => addDays(endWeek, i + 1));
    return [...daysThisWeek, ...extra];
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

/**
 * Core Smart Booking search: given a ranked therapist pool and a time
 * preference, scans forward through candidate dates/time-windows until it
 * finds available slots, widening the search (other windows same day, then
 * later days) so the patient is never left without an option.
 *
 * Returns { results, scannedDates, exactMatch } where each result is
 * { therapist, date, window, slots (aktif slots sorted by time), isExactMatch }.
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
  const rankedTherapists = rankTherapistsByComplaint(therapists, complaintSlugs, preferredTherapistIds);
  const rankedIds = new Set(rankedTherapists.map(t => t.id));
  const preferredSet = new Set(preferredTherapistIds);
  const candidateDates = buildCandidateDates(whenId, customDate);
  const windowsOrder = orderedWindows(windowId);

  let results = [];
  let scannedDates = 0;

  for (const date of candidateDates) {
    scannedDates += 1;
    const dateStr = format(date, 'yyyy-MM-dd');

    // Fetch all therapists' slot statuses for this date in one call.
    // eslint-disable-next-line no-await-in-loop
    const { data: slots } = await getAvailableSlots(dateStr, null);
    if (!slots || slots.length === 0) continue;

    const activeSlots = slots.filter(s => s.status === 'aktif' && rankedIds.has(s.therapist_id));
    if (activeSlots.length === 0) continue;

    for (const win of windowsOrder) {
      const inWindow = activeSlots.filter(s => {
        const start = (s.slot_start || '').slice(0, 5);
        return start >= win.start && start < win.end;
      });
      if (inWindow.length === 0) continue;

      const byTherapist = {};
      inWindow.forEach(s => {
        if (!byTherapist[s.therapist_id]) byTherapist[s.therapist_id] = [];
        byTherapist[s.therapist_id].push(s);
      });

      const isExactMatch = date.toDateString() === candidateDates[0].toDateString() && win.id === windowId;

      rankedTherapists.forEach(t => {
        const slotsForT = byTherapist[t.id];
        if (!slotsForT) return;
        results.push({
          therapist: t,
          date,
          window: win,
          slots: slotsForT.sort((a, b) => a.slot_start.localeCompare(b.slot_start)).slice(0, 4),
          isPreferred: preferredSet.has(t.id),
          isExactMatch
        });
      });

      if (results.length > 0) break; // found a usable window for this date, don't widen further
    }

    if (results.length > 0) break; // found matches on the earliest possible date, stop scanning
    if (results.length >= maxResults) break;
  }

  return {
    results: results.slice(0, maxResults),
    scannedDates,
    exactMatch: results.length > 0 && results[0].isExactMatch
  };
}
