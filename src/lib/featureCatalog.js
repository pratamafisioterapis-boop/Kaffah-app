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
  { key: 'modal_awal', label: 'Modal Awal', roles: ['owner'], match: (label) => label.includes('modal awal') },
  { key: 'bsi_reconciliation', label: 'Rekonsiliasi BSI', roles: ['owner'], match: (label) => label.includes('rekonsiliasi bsi') },
  { key: 'insentif_dokter', label: 'Konversi Insentif Dokter', roles: ['owner'], match: (label) => label.includes('insentif dokter') },
  { key: 'setup', label: 'Setup', roles: ['owner'], match: (label) => label === 'setup' },
  { key: 'therapist_booking', label: 'Booking Calendar', roles: ['therapist'], match: (label) => label.includes('booking calendar') },
  { key: 'therapist_appointments', label: 'Riwayat Pasien', roles: ['therapist'], match: (label) => label.includes('riwayat pasien') || label.includes('daftar appointment') },
  { key: 'therapist_evaluation', label: 'Evaluasi Pasien', roles: ['therapist'], match: (label) => label.includes('evaluasi pasien') },
];

// Feature catalog entries relevant to a given role only, in display order.
export const getFeatureCatalogForRole = (role) =>
  FEATURE_CATALOG.filter((f) => f.roles.includes(role));

// Some setup/settings sections aren't standalone nav items (they're a tab
// nested inside a bigger page, e.g. "WhatsApp" living inside Setup) but only
// make sense when another feature is enabled. Declaring the relationship
// here lets any page cascade-hide such a section without duplicating the
// on/off logic — add an entry whenever a new "X only matters if Y is on"
// pairing comes up, no need to touch the pages that consume this file.
// Key: an arbitrary sub-feature id (used by the consuming page, e.g. a Setup
// tab `value`). Value: FEATURE_CATALOG key(s) it depends on.
export const FEATURE_DEPENDENCIES = {
  whatsapp_settings: ['follow_up_management'],
};

// Human label for a sub-feature key, used only for super-admin UI hints.
export const SUB_FEATURE_LABELS = {
  whatsapp_settings: 'WhatsApp (Setup)',
};

// True if any dependency of `key` (a FEATURE_CATALOG key or a sub-feature
// key from FEATURE_DEPENDENCIES) is disabled for this role at this clinic.
export const isFeatureBlockedByDependency = (key, disabledFeaturesForRole) => {
  const deps = FEATURE_DEPENDENCIES[key];
  if (!deps || deps.length === 0 || !disabledFeaturesForRole?.length) return false;
  return deps.some((dep) => disabledFeaturesForRole.includes(dep));
};

// Labels of sub-features that will also disappear if `featureKey` is turned
// off, for showing a hint next to that feature's checkbox in super admin.
export const getDependentSubFeatureLabels = (featureKey) =>
  Object.entries(FEATURE_DEPENDENCIES)
    .filter(([, deps]) => deps.includes(featureKey))
    .map(([subKey]) => SUB_FEATURE_LABELS[subKey] || subKey);

// Returns true if this nav item should be hidden for this role because its
// matching feature key is in that role's disabled list at this clinic, or
// because a feature it depends on is disabled.
export const isNavItemDisabled = (label, role, disabledFeaturesForRole) => {
  if (!disabledFeaturesForRole || disabledFeaturesForRole.length === 0) return false;
  const lowerLabel = (label || '').toLowerCase();
  const feature = getFeatureCatalogForRole(role).find((f) => f.match(lowerLabel));
  if (!feature) return false;
  if (disabledFeaturesForRole.includes(feature.key)) return true;
  return isFeatureBlockedByDependency(feature.key, disabledFeaturesForRole);
};
