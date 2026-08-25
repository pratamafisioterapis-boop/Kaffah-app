import clsx from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names conditionally using clsx and merges tailwind classes safely.
 * @param {...(string|object|null|undefined)} inputs - Class names or conditional objects
 * @returns {string} Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(...inputs));
}

// Stopwords yang sengaja tidak tumpang tindih antar bahasa, supaya skornya
// tetap jelas beda walau teksnya penuh istilah medis/ilmiah yang sama di
// kedua bahasa (mis. "diagnosis", "assessment").
const ID_LANGUAGE_MARKERS = ['yang', 'dan', 'dengan', 'pada', 'adalah', 'tidak', 'dalam', 'untuk', 'dari', 'akan', 'atau', 'ini', 'itu', 'dapat', 'juga', 'tersebut', 'kepada', 'oleh', 'sebagai', 'karena'];
const EN_LANGUAGE_MARKERS = ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'for', 'on', 'with', 'as', 'are', 'this', 'be', 'by', 'was', 'were', 'from', 'which', 'their'];

/**
 * Mendeteksi bahasa sumber (Indonesia/Inggris) sebuah teks dengan
 * menghitung kemunculan stopword umum tiap bahasa (whole-word match).
 * Dipakai untuk auto-isi field "Bahasa Sumber" di Basis Jurnal AI.
 * @param {string} text - Teks yang mau dideteksi bahasanya
 * @returns {'id'|'en'|null} null kalau teks terlalu pendek/ambigu untuk disimpulkan
 */
export function detectJournalLanguage(text) {
  if (!text || text.trim().length < 20) return null;
  const lower = text.toLowerCase();
  const countMarkers = (markers) => markers.reduce((sum, word) => {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'));
    return sum + (matches ? matches.length : 0);
  }, 0);
  const idScore = countMarkers(ID_LANGUAGE_MARKERS);
  const enScore = countMarkers(EN_LANGUAGE_MARKERS);
  if (idScore === 0 && enScore === 0) return null;
  return idScore >= enScore ? 'id' : 'en';
}

/**
 * Formats a numeric amount into Indonesian Rupiah (IDR) currency format.
 * @param {number|string} amount - The numeric value to format
 * @returns {string} Formatted currency string (e.g., "Rp 150.000")
 */
export function formatCurrency(amount) {
  if (isNaN(amount) || amount === null) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Normalizes patient gender values into Indonesian display labels.
 * Data in the `patients` table is inconsistent ('L'/'P', 'male'/'female',
 * 'Laki-laki'/'Perempuan'), so this maps all known variants.
 * @param {string} raw - The raw gender value from the database
 * @returns {string} 'Laki-laki', 'Perempuan', the raw value, or '-'
 */
export function normalizeGender(raw) {
  if (!raw) return '-';
  const v = String(raw).trim().toLowerCase();
  if (['l', 'laki-laki', 'male', 'pria', 'm'].includes(v)) return 'Laki-laki';
  if (['p', 'perempuan', 'female', 'wanita', 'f'].includes(v)) return 'Perempuan';
  return raw;
}

/**
 * Validates if a given package type ID is a valid non-empty string.
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid
 */
export function validatePackageTypeId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Validates if a given date string or object is a valid date.
 * @param {string|Date} date - The date to validate
 * @returns {boolean} True if valid date
 */
export function validateBirthDate(date) {
  if (!date) return false;
  return !isNaN(new Date(date).getTime());
}

/**
 * Validates if the gender string matches standard Indonesian values.
 * @param {string} gender - Gender string
 * @returns {boolean} True if "Laki-laki" or "Perempuan"
 */
export function validateGender(gender) {
  return ['Laki-laki', 'Perempuan'].includes(gender);
}

/**
 * Validates if a string strictly matches the UUID format.
 * @param {string} uuid - String to check
 * @returns {boolean} True if it is a valid UUID
 */
export function validateUUIDFormatted(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuid && typeof uuid === 'string' && uuidRegex.test(uuid);
}

/**
 * Alias for validateUUIDFormatted. Validates UUID format.
 * @param {string} uuid - String to check
 * @returns {boolean} True if valid UUID
 */
export function isValidUUID(uuid) {
  return validateUUIDFormatted(uuid);
}

/**
 * Formats a given date/time string into an Indonesian 24-hour time format (HH:mm).
 * @param {string|Date} dateString - Date string or object
 * @returns {string} Formatted time string (e.g., "14:30")
 */
export function formatTimeIndonesia(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Combines a date string (YYYY-MM-DD) and a time string (HH:mm) into a Date object.
 * @param {string} dateStr - Date part (YYYY-MM-DD)
 * @param {string} timeStr - Time part (HH:mm)
 * @returns {Date|null} Constructed Date object or null if missing arguments
 */
export function constructAppointmentDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return new Date(`${dateStr}T${timeStr}`);
}

/**
 * Calculates the duration in minutes between two time strings (HH:mm).
 * @param {string} start - Start time (HH:mm)
 * @param {string} end - End time (HH:mm)
 * @returns {number} Duration in minutes
 */
export function calculateDurationMinutes(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(`1970-01-01T${start}`);
  const endDate = new Date(`1970-01-01T${end}`);
  return (endDate - startDate) / 60000;
}

/**
 * Checks if a field's value has meaningfully changed.
 * @param {*} oldValue - Original value
 * @param {*} newValue - New value
 * @returns {boolean} True if values differ
 */
export function isFieldChanged(oldValue, newValue) {
  if (oldValue === newValue) return false;
  if (!oldValue && !newValue) return false; // Treat null/undefined/empty string as equivalent
  return true;
}

/**
 * Validates if the given appointment status is an accepted value.
 * @param {string} status - The status to check
 * @returns {boolean} True if valid
 */
export function validateAppointmentStatus(status) {
  const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled', 'pending'];
  return validStatuses.includes(status);
}

/**
 * Validates if the start time is strictly before the end time.
 * @param {string} start - Start time/date
 * @param {string} end - End time/date
 * @returns {boolean} True if start < end
 */
export function validateTimeRange(start, end) {
  if (!start || !end) return false;
  return start < end;
}

/**
 * Validates if the start date is before or equal to the end date.
 * @param {string|Date} start - Start date
 * @param {string|Date} end - End date
 * @returns {boolean} True if start <= end
 */
export function validateDateRange(start, end) {
  if (!start || !end) return false;
  return new Date(start) <= new Date(end);
}

/**
 * Checks if a proposed shift overlaps with any existing shifts.
 * @param {Object} currentShift - Proposed shift {start_time, end_time}
 * @param {Array<Object>} otherShifts - Array of existing shifts
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateNoOverlappingShifts(currentShift, otherShifts = []) {
  if (!currentShift || !Array.isArray(otherShifts)) {
    return { valid: true };
  }
  for (const shift of otherShifts) {
    if (
      currentShift.start_time < shift.end_time &&
      currentShift.end_time > shift.start_time
    ) {
      return {
        valid: false,
        error: 'Jadwal bertabrakan dengan shift lain.'
      };
    }
  }
  return { valid: true };
}

/**
 * Evaluates whether a time off request represents a partial day off (start equals end).
 * @param {string} start - Start date
 * @param {string} end - End date
 * @returns {boolean} True if it is a single-day request
 */
export function validatePartialTimeOff(start, end) {
  return start === end;
}

/**
 * Triggers a browser download of a dynamically generated file.
 * @param {string} content - Raw content of the file
 * @param {string} fileName - Name of the downloaded file
 */
export function downloadCSV(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Formats an array of daily recap objects into a CSV string and downloads it.
 * @param {Array<Object>} data - Array of records
 * @param {string} [fileName='daily_recaps.csv'] - Target filename
 */
export function exportDailyRecapsToCSV(data, fileName = 'daily_recaps.csv') {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  const rows = data.map(row => 
    headers.map(fieldName => {
      const val = row[fieldName];
      return `"${String(val || '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csvContent = [headerRow, ...rows].join('\n');
  downloadCSV(csvContent, fileName);
}

/**
 * Parses generic CSV text into an array of JS objects based on header names.
 * @param {string} text - Raw CSV string
 * @returns {Array<Object>} Array of parsed objects
 */
export function parseCSVText(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    let match;
    const values = [];
    while ((match = regex.exec(line))) {
      let val = match[1] ? match[1].replace(/""/g, '"') : match[2];
      values.push(val ? val.trim() : '');
    }
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

/**
 * Alias for parseCSVText specifically for daily recaps logic.
 * @param {string} fileContent - Raw CSV text
 * @returns {Array<Object>} Parsed objects
 */
export function parseDailyRecapsCSV(fileContent) {
  return parseCSVText(fileContent);
}

/**
 * Searches for a patient match in an array based on name or MRN.
 * @param {Array<Object>} patients - Array of patient objects
 * @param {string} searchName - Name to search
 * @param {string} searchMrn - Medical Record Number to search
 * @returns {Object|null} Matching patient object or null
 */
export function findPatientMatch(patients, searchName, searchMrn) {
  if (!patients) return null;
  if (searchMrn) {
    const mrnMatch = patients.find(p => p.medical_record_number === searchMrn);
    if (mrnMatch) return mrnMatch;
  }
  if (searchName) {
    const lowerName = searchName.toLowerCase();
    return patients.find(p => p.full_name?.toLowerCase() === lowerName);
  }
  return null;
}

/**
 * Safely extracts the display name from a patient object.
 * @param {Object} patient - Patient data object
 * @returns {string} Patient name or 'Unknown'
 */
export function getPatientName(patient) {
  if (!patient) return 'Unknown';
  return patient.full_name || patient.name || 'Unknown';
}

/**
 * Maps raw patient data to a guaranteed safe object structure.
 * @param {Object} patient - Raw patient object
 * @returns {Object} Cleaned patient object
 */
export function getSafePatientData(patient) {
  return {
    id: patient?.id || null,
    full_name: patient?.full_name || '',
    medical_record_number: patient?.medical_record_number || '',
    phone: patient?.phone || ''
  };
}

/**
 * Formats a package tracking object into a readable summary string.
 * @param {Object} pkg - Package tracking object
 * @returns {string} Formatted string (e.g., "Paket A (2/10)")
 */
export function formatPackageData(pkg) {
  if (!pkg) return 'No Package';
  return `${pkg.package_name || 'Paket'} (${pkg.sessions_used || 0}/${pkg.total_sessions || 0})`;
}

/**
 * Parses working hours JSON strictly into an object.
 * @param {string|Object} json - JSON string or object
 * @returns {Object} Parsed JSON or empty object
 */
export function parseWorkingHours(json) {
  try {
    return typeof json === 'string' ? JSON.parse(json) : (json || {});
  } catch (e) {
    return {};
  }
}

/**
 * Computes the actual calendar start/end date of the recurring monthly cycle
 * that contains `referenceDate`, given a therapist's period_start_day/period_end_day
 * (e.g. 28 -> 27). Mirrors the DB function `get_therapist_period_range` so
 * frontend and backend agree on the same period without a round-trip.
 * Handles cycles crossing a month boundary and clamps to each month's real day count.
 * @param {Object} therapist - Therapist row (uses period_start_day/period_end_day, defaults 28/27)
 * @param {Date} [referenceDate] - Date to resolve the containing cycle for (defaults to now)
 * @returns {{startDate: Date, endDate: Date}}
 */
export function getTherapistPeriodRange(therapist, referenceDate = new Date()) {
  const startDay = therapist?.period_start_day ?? 28;
  const endDay = therapist?.period_end_day ?? 27;
  const ref = new Date(referenceDate);
  const refDay = ref.getDate();

  const clampToMonth = (year, month, day) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  };

  let startMonth, endMonth;
  if (startDay <= endDay) {
    // Cycle stays within a single calendar month (e.g. 1 -> 31, 5 -> 20)
    startMonth = refDay < startDay ? ref.getMonth() - 1 : ref.getMonth();
    endMonth = startMonth;
  } else {
    // Cycle crosses a month boundary (e.g. 28 -> 27)
    startMonth = refDay >= startDay ? ref.getMonth() : ref.getMonth() - 1;
    endMonth = startMonth + 1;
  }

  return {
    startDate: clampToMonth(ref.getFullYear(), startMonth, startDay),
    endDate: clampToMonth(ref.getFullYear(), endMonth, endDay)
  };
}

/**
 * Human-readable label for a therapist's configured Period, e.g. "Tgl 28 - 27".
 * @param {Object} therapist - Therapist row (uses period_start_day/period_end_day, defaults 28/27)
 * @returns {string}
 */
export function formatTherapistPeriodLabel(therapist) {
  const startDay = therapist?.period_start_day ?? 28;
  const endDay = therapist?.period_end_day ?? 27;
  return `Tgl ${startDay} - ${endDay}`;
}

/**
 * Calculates the total attendance days based on an array of payroll/attendance records.
 * @param {Array} records - Array of attendance records
 * @returns {number} Count of attendance days
 */
export function calculateAttendanceDays(schedules, timeOffs, startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  let totalDays = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0=minggu, 1=senin ...

    // 1. cek ada jadwal aktif di hari ini
    const hasSchedule = (schedules || []).some(s => {
      return s.day_of_week === day && s.is_active;
    });

    if (!hasSchedule) continue;

    // 2. cek apakah lagi cuti
    const isOnLeave = (timeOffs || []).some(t => {
      const startOff = new Date(t.start_date);
      const endOff = new Date(t.end_date);

      return d >= startOff && d <= endOff;
    });

    if (isOnLeave) continue;

    totalDays++;
  }

  return totalDays;
}

/**
 * Jumlah hari kerja terjadwal dalam 1 periode, HANYA dikurangi hari libur
 * jadwal (day_of_week yang tidak aktif) — cuti/izin TIDAK mengurangi,
 * karena ini dipakai sebagai kapasitas nominal/baseline untuk target, bukan
 * kehadiran aktual (beda dengan calculateAttendanceDays yang dipakai payroll).
 * @param {Array} schedules - Jadwal aktif terapis (therapist_schedules)
 * @param {string|Date} startDate - Awal periode
 * @param {string|Date} endDate - Akhir periode
 * @returns {number}
 */
export function calculateScheduledWorkDays(schedules, startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  let totalDays = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0=minggu, 1=senin ...
    const hasSchedule = (schedules || []).some(s => s.day_of_week === day && s.is_active);
    if (hasSchedule) totalDays++;
  }

  return totalDays;
}

/**
 * Kapasitas maksimal pasien dalam 1 periode = jumlah hari kerja terjadwal
 * (dikurangi hari libur jadwal saja, cuti/izin tetap dihitung — lihat
 * calculateScheduledWorkDays) x kapasitas maksimal pasien per hari.
 * @param {Array} schedules - Jadwal aktif terapis (therapist_schedules)
 * @param {string|Date} startDate - Awal periode
 * @param {string|Date} endDate - Akhir periode
 * @param {number} [perDayCapacity=5] - Kapasitas maksimal pasien per hari kerja
 * @returns {number}
 */
export function calculateMaxPatientCapacity(schedules, startDate, endDate, perDayCapacity = 5) {
  const workDays = calculateScheduledWorkDays(schedules, startDate, endDate);
  return workDays * perDayCapacity;
}

/**
 * Target kunjungan periode berikutnya berdasarkan capaian periode berjalan:
 * - Kalau target periode ini TERCAPAI: target baru = target sebelumnya + 2%
 *   dari kapasitas maksimal pasien periode ini (dibulatkan).
 * - Kalau BELUM TERCAPAI: target baru = disamakan dengan target sebelumnya.
 * @param {Object} params
 * @param {number} params.previousTarget - Target kunjungan periode berjalan
 * @param {boolean} params.achieved - Apakah target periode berjalan tercapai
 * @param {number} params.maxCapacity - Kapasitas maksimal pasien periode berjalan (calculateMaxPatientCapacity)
 * @param {number} [params.bonusPercent=2] - Persentase kenaikan dari kapasitas maksimal
 * @returns {number}
 */
export function calculateNextPeriodTarget({ previousTarget = 0, achieved = false, maxCapacity = 0, bonusPercent = 2 }) {
  if (!achieved) return previousTarget;
  return previousTarget + Math.round((bonusPercent / 100) * maxCapacity);
}

/**
 * Calculates standard full salary (base salary + (transport allowance * days)).
 * @param {number|string} base - Base monthly salary
 * @param {number|string} transport - Transport allowance per day
 * @param {number|string} days - Number of days attended
 * @returns {number} Total full salary
 */
export const calculateFullSalary = (recaps) => {
  return (recaps || []).reduce((total, item) => {

    if (item.package_tracking_id && item.amount_package) {
      return total + item.amount_package;
    }

    return total + (item.amount || 0);

  }, 0);
};

/**
 * Calculates custom commission-based salary.
 * @param {number|string} base - Base salary
 * @param {number|string} commission - Total commission earned
 * @returns {number} Total custom salary
 */
export function calculateCustomSalary(recaps, rates) {
  if (!recaps || !Array.isArray(recaps)) return 0;

  return recaps.reduce((total, r) => {
    const type = r.patient_type || r.service_type || '';
    
    // cari rate yg mengandung keyword (flexible match)
    const matchedKey = Object.keys(rates).find(key =>
      key.toLowerCase().includes(type.toLowerCase())
    );

    const rate = parseFloat(rates[matchedKey]) || 0;

    return total + rate;
  }, 0);
}

/**
 * Computes therapist remuneration commission from performance score and profit margin.
 * Profit = omzet (revenue) yang dihasilkan terapis dikurangi take-home pay
 * sebelum komisi (base + transport + insentif). Komisi = ratePercent% dari
 * profit, discale oleh overallScore (0-100), dan di-floor ke 0 kalau profit
 * negatif atau remunerasi tidak aktif untuk terapis tsb.
 * @param {Object} params
 * @param {number} params.revenue - Omzet terapis pada periode (calculateFullSalary)
 * @param {number} params.baseSalary
 * @param {number} params.transportAllowance
 * @param {number} params.incentiveAmount
 * @param {number} params.overallScore - Skor performa remunerasi (0-100)
 * @param {boolean} params.remunerationEnabled
 * @param {number} [params.ratePercent=2] - Tarif komisi dalam persen dari profit
 * @returns {{ profit: number, marginPercent: number, commission: number }}
 */
export function calculateRemunerationCommission({
  revenue = 0,
  baseSalary = 0,
  transportAllowance = 0,
  incentiveAmount = 0,
  overallScore = 0,
  remunerationEnabled = true,
  ratePercent = 2,
}) {
  const takehomeBeforeCommission = baseSalary + transportAllowance + incentiveAmount;
  const profit = revenue - takehomeBeforeCommission;
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

  if (!remunerationEnabled || profit <= 0) {
    return { profit, marginPercent, commission: 0 };
  }

  const commission = Math.round((ratePercent / 100) * profit * (overallScore / 100));
  return { profit, marginPercent, commission: Math.max(0, commission) };
}

/**
 * Stub function to calculate total salary based on complex schemes.
 * @param {Array} records - Attendance/Session records
 * @param {string} scheme - Payroll scheme identifier
 * @returns {number} Total calculated salary
 */
export function calculateTotalSalary(records, scheme) {
  return 0; // Extended implementation depending on domain logic
}

/**
 * Defers execution of a function until a specified wait time has passed since the last invocation.
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}