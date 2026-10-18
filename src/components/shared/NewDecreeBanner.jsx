import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { getClinicDecrees } from '@/lib/api';
import { getSeenDecreeIds } from '@/lib/decreeSeen';

const DECREE_BANNER_DAYS = 7;

// Banner "Ada SK baru" di dashboard terapis/admin Kaffah. Hilang setelah
// daftar SK dibuka (lihat ClinicDecreesViewer), atau otomatis setelah 7 hari
// sejak SK terbit.
const NewDecreeBanner = ({ to }) => {
  const { user, userDetails } = useAuth();
  const [unseen, setUnseen] = useState([]);

  useEffect(() => {
    if (userDetails?.clinic_id !== KAFFAH_CLINIC_ID) return undefined;
    let active = true;
    getClinicDecrees().then(({ data }) => {
      if (!active) return;
      const seen = getSeenDecreeIds(user?.id);
      const now = Date.now();
      setUnseen((data || []).filter((d) => {
        if (d.status !== 'issued' || seen.includes(d.id)) return false;
        // updated_at ikut berubah saat SK diterbitkan (status draft -> issued)
        const publishedAt = new Date(d.updated_at || d.created_at).getTime();
        return Number.isNaN(publishedAt) || now - publishedAt <= DECREE_BANNER_DAYS * 86400000;
      }));
    });
    return () => { active = false; };
  }, [userDetails?.clinic_id, user?.id]);

  if (unseen.length === 0) return null;

  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 mb-4 rounded-app-sm border border-blue-200 bg-blue-50 text-blue-900 text-sm hover:bg-blue-100 transition-colors"
    >
      <ScrollText className="w-4 h-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">
        Ada SK baru dari pimpinan: <strong>{unseen[0].title}</strong>{unseen.length > 1 ? ` (+${unseen.length - 1} lainnya)` : ''}
      </span>
      <ChevronRight className="w-4 h-4 shrink-0" />
    </Link>
  );
};

export default NewDecreeBanner;
