import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { PackageRecapsContent } from '@/pages/admin/PackageRecaps';
import { OWNER_NAV_ITEMS } from '@/lib/navItems';

// Owner Wrapper
const PackageRecapsOwner = () => {
    return (
        <DashboardLayout role="owner" userName="Owner" navItems={OWNER_NAV_ITEMS}>
            <PackageRecapsContent />
        </DashboardLayout>
    );
};

export default PackageRecapsOwner;