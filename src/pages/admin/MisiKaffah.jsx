import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/lib/navItems';
import LoyaltyMissionsContent from '@/components/shared/LoyaltyMissionsContent';

const MisiKaffahAdmin = () => (
  <DashboardLayout role="admin" navItems={ADMIN_NAV_ITEMS}>
    <LoyaltyMissionsContent />
  </DashboardLayout>
);

export default MisiKaffahAdmin;
