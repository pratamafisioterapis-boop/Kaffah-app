import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/lib/navItems';
import PatientPortalInboxContent from '@/components/shared/PatientPortalInbox';

const ClinaraPatientsAdmin = () => (
  <DashboardLayout role="admin" navItems={ADMIN_NAV_ITEMS}>
    <PatientPortalInboxContent />
  </DashboardLayout>
);

export default ClinaraPatientsAdmin;
