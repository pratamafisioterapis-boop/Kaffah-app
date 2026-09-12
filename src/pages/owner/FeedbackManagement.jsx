import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { FeedbackManagementContent } from '@/pages/FeedbackManagementPage';
import { OWNER_NAV_ITEMS } from '@/lib/navItems';

const FeedbackManagementOwner = () => (
  <DashboardLayout role="owner" navItems={OWNER_NAV_ITEMS}>
    <FeedbackManagementContent />
  </DashboardLayout>
);

export default FeedbackManagementOwner;
