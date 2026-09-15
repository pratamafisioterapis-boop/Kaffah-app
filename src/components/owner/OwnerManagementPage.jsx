import React from 'react';
import { Crown } from 'lucide-react';
import OwnerAccountManager from '@/components/owner/OwnerAccountManager';

const OwnerManagementPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
            <Crown className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Owner Management</h2>
            <p className="text-sm text-slate-400 mt-0.5">Kelola akun owner lain yang memiliki akses penuh ke klinik ini</p>
          </div>
        </div>
      </div>

      <OwnerAccountManager />
    </div>
  );
};

export default OwnerManagementPage;
