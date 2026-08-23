// Attendance-machine exports only carry short/nicknames ("annisa", "adi
// pratama", "pras"), while physiotherapist profiles carry a formal name
// with academic titles ("Annisa Septiyani,S.Kes.,Ftr", "Ftr. Muhammad
// Fahri"). An exact (even case-insensitive) string match almost never
// succeeds between the two, so attendance rows silently fail to link to a
// physiotherapist and fall back to default lateness rules. This matches on
// name *words* instead, after stripping common academic-title tokens.
const TITLE_TOKENS = new Set([
  'ftr', 's', 'kes', 'fis', 'ft', 'tr', 'amd', 'a', 'md', 'sp', 'ners', 'ns', 'psi', 'apt', 'dr', 'drg', 'str',
]);

const normalizeNameWords = (fullName) =>
  (fullName || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !TITLE_TOKENS.has(w));

/**
 * Finds the single physiotherapist whose name plausibly matches the given
 * attendance employee name. Checks `aliasMap` first (an admin-confirmed
 * employee-name -> physiotherapist_id mapping for nicknames the automatic
 * matcher can't safely resolve, e.g. "dilla" -> Nurfadilah's id — see
 * getAttendanceEmployeeAliases). Otherwise every word of `employeeName` must
 * exactly equal, or be a >=3-char prefix of, some word in the candidate's
 * cleaned name. Returns null (rather than guessing) when there's no match or
 * more than one equally plausible match.
 */
export const matchEmployeeNameToTherapist = (employeeName, therapists, aliasMap) => {
  const empWords = (employeeName || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (empWords.length === 0 || !therapists?.length) return null;

  const aliasedId = aliasMap?.get(employeeName.trim().toLowerCase());
  if (aliasedId) {
    const aliased = therapists.find((t) => t.id === aliasedId);
    if (aliased) return aliased;
  }

  const exact = therapists.find((t) => (t.name || '').trim().toLowerCase() === employeeName.trim().toLowerCase());
  if (exact) return exact;

  const candidates = therapists.filter((t) => {
    const words = normalizeNameWords(t.name);
    return empWords.every((ew) => words.some((w) => w === ew || (ew.length >= 3 && w.startsWith(ew))));
  });

  return candidates.length === 1 ? candidates[0] : null;
};
