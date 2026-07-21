// Canonical sidebar menu lists for the owner and admin dashboards. Several
// pages are routed standalone (outside the main OwnerDashboard/AdminDashboard
// route tree) and render their own DashboardLayout with their own `navItems`
// prop — importing from here instead of hand-copying the list keeps them
// from drifting out of sync and losing menu items over time.

export const OWNER_NAV_ITEMS = [
  { label: 'Dashboard', path: '/owner/dashboard', icon: 'Home' },
  { label: 'Appointments', path: '/owner/appointments', icon: 'Calendar' },
  { label: 'Daily Recaps', path: '/owner/daily-recap', icon: 'FileText' },
  { label: 'Package Recaps', path: '/owner/package-recaps', icon: 'Package' },
  { label: 'Database Patients', path: '/owner/database-patients', icon: 'Database' },
  { label: 'Medical Records', path: '/owner/medical-records', icon: 'Activity' },
  { label: 'Follow Up Management', path: '/owner/follow-up-management', icon: 'ClipboardList' },
  { label: 'Physiotherapist Management', path: '/owner/physiotherapist-management', icon: 'Users' },
  { label: 'Accounting System', path: '/owner/accounting', icon: 'BriefcaseMedical' },
  { label: 'Modal Awal', path: '/owner/modal-awal', icon: 'Wallet' },
  { label: 'Stok Barang', path: '/owner/inventory', icon: 'Boxes' },
  { label: 'Rekonsiliasi BSI', path: '/owner/bsi-reconciliation', icon: 'FileSearch' },
  { label: 'Konversi Insentif Dokter', path: '/owner/insentif-dokter', icon: 'FileSpreadsheet' },
  { label: 'Setup', path: '/owner/settings', icon: 'Settings' },
];

export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', path: '/admin', icon: 'Home' },
  { label: 'Database Patients', path: '/admin/database-patients', icon: 'Database' },
  { label: 'Appointments', path: '/admin/appointments', icon: 'Calendar' },
  { label: 'Medical Records', path: '/admin/medical-records', icon: 'Activity' },
  { label: 'Daily Recaps', path: '/admin/daily-recap', icon: 'FileText' },
  { label: 'Package Recaps', path: '/admin/package-recaps', icon: 'Package' },
  { label: 'Physiotherapist Management', path: '/admin/physiotherapist-management', icon: 'Users' },
  { label: 'Follow Up Management', path: '/admin/follow-up-management', icon: 'ClipboardList' },
  { label: 'Clinical Documents', path: '/admin/clinical-documents', icon: 'FileText' },
  { label: 'Accounting System', path: '/admin/accounting', icon: 'DollarSign' },
  { label: 'Ambil Barang Gudang', path: '/admin/inventory-takeout', icon: 'Boxes' },
  { label: 'Check Transaksi', path: '/admin/check-transaksi', icon: 'FileSearch' },
  { label: 'Setup Akun', path: '/admin/settings', icon: 'Settings' },
];
