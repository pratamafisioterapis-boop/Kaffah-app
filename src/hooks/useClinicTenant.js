import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// Resolves the clinic that owns the current hostname (its subdomain, e.g.
// kliniksehat.clinara.id, or its verified custom domain, e.g.
// kliniksehat.com) via the public get_clinic_by_host() RPC. Used to render
// a clinic's own branded public site when visitors land on its domain
// instead of the platform's own domains.
export const useClinicTenant = (hostname = window.location.hostname) => {
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);

    supabase
      .rpc('get_clinic_by_host', { p_host: hostname })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data || data.length === 0) {
          setNotFound(true);
          setClinic(null);
        } else {
          setClinic(data[0]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [hostname]);

  return { clinic, loading, notFound };
};
