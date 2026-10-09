import React from 'react';
import OwnerAccountManager from '@/components/owner/OwnerAccountManager';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import PageHero from '@/components/shared/PageHero';

const OwnerManagementPage = () => {
  const { clinicName } = useAuth();

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      {/* Hero Banner */}
      <PageHero image="/hero/clinara-physio-hero.webp" title="Owner" highlight="Management" description="Kelola akun owner lain yang memiliki akses penuh ke klinik ini." />

      <OwnerAccountManager />
    </div>
  );
};

export default OwnerManagementPage;
