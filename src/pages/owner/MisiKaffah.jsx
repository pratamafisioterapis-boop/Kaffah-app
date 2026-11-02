import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { OWNER_NAV_ITEMS } from '@/lib/navItems';
import LoyaltyMissionsContent from '@/components/shared/LoyaltyMissionsContent';

const MisiKaffahOwner = () => (
  <DashboardLayout role="owner" navItems={OWNER_NAV_ITEMS}>
    <LoyaltyMissionsContent />
  </DashboardLayout>
);

export default MisiKaffahOwner;
