import { formatPackageData } from '@/lib/utils';

const normalizePackageStatus = (status) => {
  if (!status) return status;
  const s = status.toLowerCase();
  if (s === 'habis') return 'selesai';
  return s;
};

export const buildPackageData = (trackings, recaps, packageDefinitions) => {
  return (trackings || []).map(pkg => {
    const formatted = formatPackageData(pkg, recaps, packageDefinitions);

    return {
      ...formatted,

      patient_name: formatted.patient_name || pkg.patient?.full_name || '-',
      package_name: formatted.package_name || pkg.package_name || '-',

      computed_sessions_used: pkg.sessions_used || 0,
      computed_sessions_remaining: pkg.sessions_remaining || 0,
      computed_total_sessions: pkg.total_sessions || 0,
      computed_status: normalizePackageStatus(pkg.status),

      end_date: formatted.end_date || pkg.end_date || null,
    };
  });
};