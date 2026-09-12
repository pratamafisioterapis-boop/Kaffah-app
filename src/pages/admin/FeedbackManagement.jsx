import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { FeedbackManagementContent } from '@/pages/FeedbackManagementPage';
import { ADMIN_NAV_ITEMS } from '@/lib/navItems';

const FeedbackManagementAdmin = () => (
  <DashboardLayout role="admin" navItems={ADMIN_NAV_ITEMS}>
    <FeedbackManagementContent />
  </DashboardLayout>
);

export default FeedbackManagementAdmin;
