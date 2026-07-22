// Togglable clinic features, per role. Super Admin can disable any of these
// per clinic per role (clinics.disabled_features_by_role jsonb, shaped as
// { owner: [...keys], admin: [...keys], therapist: [...keys] }) to hide
// them from that role's sidebar and PWA menu at that clinic.
export const ROLES = ['owner', 'admin', 'therapist'];

export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  therapist: 'Therapist',
};

export const FEATURE_CATALOG = [
  { key: 'dashboard', label: 'Dashboard', roles: ['owner', 'admin', 'therapist'], match: (label) => label === 'dashboard' },
  { key: 'appointments', label: 'Appointments', roles: ['owner', 'admin'], match: (label) => label.includes('appointment') || label.includes('calendar') },
  { key: 'daily_recaps', label: 'Daily Recaps', roles: ['owner', 'admin'], match: (label) => label.includes('daily recaps') },
  { key: 'package_recaps', label: 'Package Recaps', roles: ['owner', 'admin'], match: (label) => label.includes('package recaps') },
  { key: 'database_pasien', label: 'Database Pasien', roles: ['owner', 'admin'], match: (label) => label.includes('database pasien') || label.includes('database patients') },
  { key: 'medical_records', label: 'Medical Records', roles: ['owner', 'admin'], match: (label) => label.includes('medical records') },
  { key: 'physiotherapist_management', label: 'Physiotherapist Management', roles: ['owner', 'admin'], match: (label) => label.includes('physiotherapist management') },
  { key: 'admin_management', label: 'Admin Management', roles: ['owner'], match: (label) => label.includes('admin management') },
  { key: 'follow_up_management', label: 'Follow Up Management', roles: ['owner', 'admin'], match: (label) => label.includes('follow up') },
  { key: 'clinical_documents', label: 'Clinical Documents', roles: ['admin'], match: (label) => label.includes('clinical documents') },
  { key: 'accounting', label: 'Accounting System', roles: ['owner', 'admin'], match: (label) => label.includes('accounting') },
  { key: 'inventory', label: 'Stok Barang / Ambil Barang Gudang', roles: ['owner', 'admin'], match: (label) => label.includes('barang') || label.includes('inventory') },
  { key: 'check_transaksi', label: 'Check Transaksi', roles: ['admin'], match: (label) => label.includes('check transaksi') },
  { key: 'setup_akun', label: 'Setup Akun', roles: ['admin'], match: (label) => label.includes('setup akun') },
  { key: 'modal_awal', label: 'Modal Awal', roles: ['owner'], match: (label) => label.includes('modal awal') },
  { key: 'bsi_reconciliation', label: 'Rekonsiliasi BSI', roles: ['owner'], match: (label) => label.includes('rekonsiliasi bsi') },
  { key: 'insentif_dokter', label: 'Konversi Insentif Dokter', roles: ['owner'], match: (label) => label.includes('insentif dokter') },
  { key: 'setup', label: 'Setup', roles: ['owner'], match: (label) => label === 'setup' },
  { key: 'therapist_booking', label: 'Booking Calendar', roles: ['therapist'], match: (label) => label.includes('booking calendar') },
  { key: 'therapist_appointments', label: 'Riwayat Pasien', roles: ['therapist'], match: (label) => label.includes('riwayat pasien') || label.includes('daftar appointment') },
  { key: 'therapist_evaluation', label: 'Evaluasi Pasien', roles: ['therapist'], match: (label) => label.includes('evaluasi pasien') },
  { key: 'therapist_settings', label: 'Settings', roles: ['therapist'], match: (label) => label === 'settings' },
];

// Feature catalog entries relevant to a given role only, in display order.
export const getFeatureCatalogForRole = (role) =>
  FEATURE_CATALOG.filter((f) => f.roles.includes(role));

// Returns true if this nav item should be hidden for this role because its
// matching feature key is in that role's disabled list at this clinic.
export const isNavItemDisabled = (label, role, disabledFeaturesForRole) => {
  if (!disabledFeaturesForRole || disabledFeaturesForRole.length === 0) return false;
  const lowerLabel = (label || '').toLowerCase();
  const feature = getFeatureCatalogForRole(role).find((f) => f.match(lowerLabel));
  return feature ? disabledFeaturesForRole.includes(feature.key) : false;
};

// The "Setup" menu (owner only) is itself a tabbed page (see
// SETTINGS_TAB_GROUPS in SettingsPage.jsx). Super Admin can additionally
// hide individual Setup tabs per clinic — e.g. hide the WhatsApp tab for a
// clinic that doesn't use Follow Up features — independently of the
// top-level "Setup" toggle. Keys here match each tab's `value`.
export const SETUP_SUB_FEATURES = [
  { key: 'account_clinic', label: 'Akun & Klinik' },
  { key: 'bank_accounts', label: 'Akun Bank' },
  { key: 'accounting_cats', label: 'Akunting' },
  { key: 'service_rates', label: 'Tarif Jasa' },
  { key: 'payment', label: 'Pembayaran' },
  { key: 'discount', label: 'Jenis Diskon' },
  { key: 'whatsapp_settings', label: 'WhatsApp' },
  { key: 'google_drive', label: 'Google Drive' },
  { key: 'google_sheets', label: 'Backup Google Sheets' },
  { key: 'diagnosis_service', label: 'Diagnosa & Layanan' },
  { key: 'source', label: 'Sumber' },
  { key: 'type', label: 'Tipe Pasien' },
  { key: 'package', label: 'Tipe Paket' },
  { key: 'design_style', label: 'Tampilan' },
  { key: 'media_assets', label: 'Media' },
];
