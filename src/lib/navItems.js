// Canonical sidebar menu lists for the owner and admin dashboards. Several
// pages are routed standalone (outside the main OwnerDashboard/AdminDashboard
// route tree) and render their own DashboardLayout with their own `navItems`
// prop — importing from here instead of hand-copying the list keeps them
// from drifting out of sync and losing menu items over time.

import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

export const OWNER_NAV_ITEMS = [
  { label: 'Dashboard', path: '/owner/dashboard', icon: 'Home' },
  { label: 'Presentasi Direksi', path: '/owner/presentation', icon: 'MonitorPlay' },
  {
    label: 'Clinic Management',
    icon: 'Calendar',
    submenu: [
      { label: 'Appointments', path: '/owner/appointments', icon: 'Calendar' },
      { label: 'Daily Recaps', path: '/owner/daily-recap', icon: 'FileText' },
      { label: 'Package Recaps', path: '/owner/package-recaps', icon: 'Package' },
      { label: 'Database Patients', path: '/owner/database-patients', icon: 'Database' },
      { label: 'Medical Records', path: '/owner/medical-records', icon: 'Activity' },
      { label: 'Clinical Documents', path: '/owner/clinical-documents', icon: 'UploadCloud' },
      { label: 'Follow Up Management', path: '/owner/follow-up-management', icon: 'MessageSquare' },
      { label: 'Pengajuan & Audit SOAP', path: '/owner/overrides', icon: 'ShieldCheck', clinicOnly: KAFFAH_CLINIC_ID },
      { label: 'Patients Feedback', path: '/owner/feedback', icon: 'Star' },
      { label: 'Stok Barang', path: '/owner/inventory', icon: 'Boxes' },
    ],
  },
  {
    label: 'Teams & Staffs',
    icon: 'Users',
    submenu: [
      { label: 'Physiotherapist Management', path: '/owner/physiotherapist-management', icon: 'UserCog' },
      { label: 'Admin Management', path: '/owner/admin-management', icon: 'ShieldCheck' },
      { label: 'Owner Management', path: '/owner/owner-management', icon: 'Crown' },
      { label: 'Absensi Karyawan', path: '/owner/attendance', icon: 'Clock' },
      { label: 'SK Pimpinan', path: '/owner/decrees', icon: 'FileText', clinicOnly: KAFFAH_CLINIC_ID },
      { label: 'Review Video Latihan', path: '/owner/review-latihan', icon: 'MonitorPlay', clinicOnly: KAFFAH_CLINIC_ID },
    ],
  },
  {
    label: 'Accounting System',
    icon: 'BriefcaseMedical',
    submenu: [
      { label: 'Accounting System', path: '/owner/accounting', icon: 'BriefcaseMedical' },
      { label: 'Rekonsiliasi BSI', path: '/owner/bsi-reconciliation', icon: 'FileSearch' },
    ],
  },
  { label: 'Modal Awal', path: '/owner/modal-awal', icon: 'Wallet' },
  { label: 'Setup', path: '/owner/settings', icon: 'Settings' },
];

export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', path: '/admin', icon: 'Home' },
  {
    label: 'Clinic Management',
    icon: 'Calendar',
    submenu: [
      { label: 'Appointments', path: '/admin/appointments', icon: 'Calendar' },
      { label: 'Daily Recaps', path: '/admin/daily-recap', icon: 'FileText' },
      { label: 'Package Recaps', path: '/admin/package-recaps', icon: 'Package' },
      { label: 'Database Patients', path: '/admin/database-patients', icon: 'Database' },
      { label: 'Medical Records', path: '/admin/medical-records', icon: 'Activity' },
      { label: 'Clinical Documents', path: '/admin/clinical-documents', icon: 'FileText' },
      { label: 'Follow Up Management', path: '/admin/follow-up-management', icon: 'ClipboardList' },
      { label: 'Feedback Pasien', path: '/admin/feedback', icon: 'Star' },
      { label: 'Ambil Barang Gudang', path: '/admin/inventory-takeout', icon: 'Boxes' },
      { label: 'SK Pimpinan', path: '/admin/decrees', icon: 'FileText', clinicOnly: KAFFAH_CLINIC_ID },
    ],
  },
  {
    label: 'Teams & Staffs',
    icon: 'Users',
    submenu: [
      { label: 'Physiotherapist Management', path: '/admin/physiotherapist-management', icon: 'Users' },
      { label: 'Absensi Karyawan', path: '/admin/attendance', icon: 'Clock' },
    ],
  },
  {
    label: 'Accounting System',
    icon: 'DollarSign',
    submenu: [
      { label: 'Accounting System', path: '/admin/accounting', icon: 'DollarSign' },
      { label: 'Check Transaksi', path: '/admin/check-transaksi', icon: 'FileSearch' },
    ],
  },
  { label: 'Setup Akun', path: '/admin/settings', icon: 'Settings' },
];
