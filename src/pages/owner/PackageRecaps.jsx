import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { PackageRecapsContent } from '@/pages/admin/PackageRecaps';

// Owner Wrapper
const PackageRecapsOwner = () => {
    // Owner Nav Items
    const ownerNavItems = [
        { label: 'Dashboard', path: '/owner/dashboard', icon: 'Home' },
        { label: 'Appointments', path: '/owner/appointments', icon: 'Calendar' },
        { label: 'Daily Recaps', path: '/owner/daily-recap', icon: 'ClipboardList' },
        { label: 'Package Recaps', path: '/owner/package-recaps', icon: 'Package' }, // Explicitly added
        { label: 'Medical Records', path: '/owner/medical-records', icon: 'Activity' },
        { label: 'Follow Up Management', path: '/owner/follow-up-management', icon: 'MessageSquare' },
        { label: 'Physiotherapist Management', path: '/owner/physiotherapist-management', icon: 'Users' },
        { label: 'Accounting System', path: '/owner/accounting', icon: 'DollarSign' },
        { label: 'Rekonsiliasi BSI', path: '/owner/bsi-reconciliation', icon: 'FileSearch' },
        { label: 'Setup', path: '/owner/settings', icon: 'Settings' }
    ];

    return (
        <DashboardLayout role="owner" navItems={ownerNavItems}>
            <PackageRecapsContent />
        </DashboardLayout>
    );
};

export default PackageRecapsOwner;