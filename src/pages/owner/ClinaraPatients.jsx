import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { OWNER_NAV_ITEMS } from '@/lib/navItems';
import PatientPortalInboxContent from '@/components/shared/PatientPortalInbox';

const ClinaraPatientsOwner = () => (
  <DashboardLayout role="owner" navItems={OWNER_NAV_ITEMS}>
    <PatientPortalInboxContent />
  </DashboardLayout>
);

export default ClinaraPatientsOwner;
