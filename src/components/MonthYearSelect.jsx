import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const buildMonthOptions = (yearsBack = 3, monthsForward = 6) => {
  const now = new Date();
  const start = new Date(now.getFullYear() - yearsBack, now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthsForward, 1);
  const options = [];
  const cur = new Date(end);
  while (cur >= start) {
    const value = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: `${MONTH_NAMES_ID[cur.getMonth()]} ${cur.getFullYear()}` });
    cur.setMonth(cur.getMonth() - 1);
  }
  return options;
};

// Dropdown pemilih periode bulan, tampil sebagai "Januari 2026" — dipakai di
// seluruh app Konversi Dokter sebagai pengganti input <month> native.
const MonthYearSelect = ({ value, onChange, variant = 'light', className, placeholder = 'Pilih bulan' }) => {
  const options = useMemo(() => {
    const opts = buildMonthOptions();
    if (value && !opts.some((o) => o.value === value)) {
      const [y, m] = value.split('-').map(Number);
      if (y && m) opts.unshift({ value, label: `${MONTH_NAMES_ID[m - 1]} ${y}` });
    }
    return opts;
  }, [value]);

  const isDark = variant === 'dark';

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          isDark
            ? 'h-8 w-auto border-none bg-transparent text-white text-sm font-medium px-1 gap-1.5 focus:ring-0 focus:ring-offset-0 hover:bg-white/5 rounded-lg'
            : 'h-9 bg-white',
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default MonthYearSelect;
