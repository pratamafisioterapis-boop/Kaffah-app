import { format, parseISO, isValid, parse } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export const formatDateIndonesian = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '-';
    return format(date, 'EEEE, d MMMM yyyy', { locale: idLocale });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

export const formatTime = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '-';
    return format(date, 'HH:mm');
  } catch (error) {
    return '-';
  }
};

export const getCurrentTimeWithSeconds = () => {
    return format(new Date(), 'HH:mm:ss');
};

export const displayDateID = (isoDateString) => {
    if (!isoDateString) return '';
    try {
        // Handle if full ISO string with time
        const datePart = isoDateString.split('T')[0];
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return '';
    }
};

export const parseDateFromDisplay = (displayDateString) => {
    if (!displayDateString) return null;
    try {
        // Expect dd/MM/yyyy
        const [day, month, year] = displayDateString.split('/');
        if (!day || !month || !year) return null;
        return `${year}-${month}-${day}`;
    } catch (e) {
        return null;
    }
};

export const isValidDateFormat = (dateString) => {
    if (!dateString) return false;
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateString)) return false;
    
    const [day, month, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
};

// Aliases for compatibility
export const formatDateDisplay = displayDateID;
// Parse tanggal tanpa pergeseran zona waktu. String 'YYYY-MM-DD' (kolom DATE di
// DB) oleh `new Date()` dibaca sebagai UTC tengah malam, sehingga di zona waktu
// di belakang UTC (atau saat diformat ulang) tampil mundur sehari (28 -> 27).
// Untuk string tanggal murni kita bangun Date lokal; selain itu fallback normal.
export const parseLocalDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
};
