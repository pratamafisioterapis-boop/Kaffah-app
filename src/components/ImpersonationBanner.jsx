import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ShieldAlert } from 'lucide-react';

const ROLE_HOME_PATH = {
  super_admin: '/super-admin',
  owner: '/owner',
  admin: '/admin',
  clinic_admin: '/admin',
  therapist: '/therapist',
  physiotherapist: '/therapist',
};

const ImpersonationBanner = () => {
  const { isImpersonating, impersonationOrigin, stopImpersonation, userDetails, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (!isImpersonating) return null;

  const targetLabel = userDetails?.full_name || userDetails?.email || user?.email || 'akun ini';

  const handleReturn = async () => {
    const { error } = await stopImpersonation();
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal kembali ke super admin', description: error.message });
      return;
    }
    toast({ title: 'Kembali ke sesi Super Admin' });
    navigate(ROLE_HOME_PATH.super_admin, { replace: true });
  };

  return (
    <div className="sticky top-0 z-[9999] w-full bg-amber-500 text-amber-950 px-3 py-2 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-medium shadow-md">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[70vw] sm:max-w-none">
        Mode Remote Super Admin — login sebagai <strong>{targetLabel}</strong>
        {impersonationOrigin?.admin_email ? (
          <span className="hidden sm:inline"> (oleh {impersonationOrigin.admin_email})</span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={handleReturn}
        className="shrink-0 bg-amber-950 text-amber-50 px-3 py-1 rounded-md hover:bg-amber-900 transition-colors"
      >
        Kembali ke Super Admin
      </button>
    </div>
  );
};

export default ImpersonationBanner;
