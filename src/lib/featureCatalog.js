// Togglable clinic features. Super Admin can disable any of these per clinic
// (clinics.disabled_features text[]) to hide them from that clinic's Admin/
// Owner sidebar and PWA menu.
export const FEATURE_CATALOG = [
  { key: 'dashboard', label: 'Dashboard', match: (label) => label === 'dashboard' },
  { key: 'appointments', label: 'Appointments', match: (label) => label.includes('appointment') || label.includes('calendar') },
  { key: 'daily_recaps', label: 'Daily Recaps', match: (label) => label.includes('daily recaps') },
  { key: 'package_recaps', label: 'Package Recaps', match: (label) => label.includes('package recaps') },
  { key: 'database_pasien', label: 'Database Pasien', match: (label) => label.includes('database pasien') || label.includes('database patients') },
  { key: 'medical_records', label: 'Medical Records', match: (label) => label.includes('medical records') },
  { key: 'physiotherapist_management', label: 'Physiotherapist Management', match: (label) => label.includes('physiotherapist management') },
  { key: 'follow_up_management', label: 'Follow Up Management', match: (label) => label.includes('follow up') },
  { key: 'clinical_documents', label: 'Clinical Documents', match: (label) => label.includes('clinical documents') },
  { key: 'accounting', label: 'Accounting System', match: (label) => label.includes('accounting') },
  { key: 'inventory', label: 'Stok Barang / Ambil Barang Gudang', match: (label) => label.includes('barang') || label.includes('inventory') },
  { key: 'check_transaksi', label: 'Check Transaksi', match: (label) => label.includes('check transaksi') },
  { key: 'modal_awal', label: 'Modal Awal', match: (label) => label.includes('modal awal') },
  { key: 'bsi_reconciliation', label: 'Rekonsiliasi BSI', match: (label) => label.includes('rekonsiliasi bsi') },
  { key: 'insentif_dokter', label: 'Konversi Insentif Dokter', match: (label) => label.includes('insentif dokter') },
  { key: 'setup', label: 'Setup', match: (label) => label === 'setup' },
];

// Returns true if this nav item should be hidden because its matching
// feature key is in the clinic's disabled_features list.
export const isNavItemDisabled = (label, disabledFeatures) => {
  if (!disabledFeatures || disabledFeatures.length === 0) return false;
  const lowerLabel = (label || '').toLowerCase();
  const feature = FEATURE_CATALOG.find((f) => f.match(lowerLabel));
  return feature ? disabledFeatures.includes(feature.key) : false;
};
