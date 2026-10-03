import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Stethoscope, Loader2, Shield, UserCog } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

// Lets an admin step into a therapist's "Evaluasi Pasien" to fill SOAP on
// their behalf. The auth session stays the admin's; the SOAP is recorded
// under the therapist and flagged as filled via admin.
const AdminTherapistSwitcher = ({ clinicId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const inTherapistMode = location.pathname.startsWith('/admin/as-therapist');
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 8, width: 300 });
  const [open, setOpen] = useState(false);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !clinicId) return;
    let active = true;
    setLoading(true);
    supabase
      .from('physiotherapists')
      .select('id, name, email')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .not('user_id', 'is', null)
      .order('name')
      .then(({ data }) => {
        if (!active) return;
        setTherapists(data || []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [open, clinicId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(300, vw - 16);
      const left = Math.min(Math.max(8, r.right - width), vw - width - 8);
      setPos({ top: r.bottom + 8, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-9 h-9 rounded-full sm:rounded-xl border bg-white flex items-center justify-center hover:text-[#1677D2] hover:bg-[#F5F9FC] transition-colors shadow-sm',
          inTherapistMode ? 'border-amber-400 text-amber-600' : 'border-[#DCE8F2] text-[#102F52]'
        )}
        aria-label="Pindah ke akun terapis"
        title="Pindah ke akun terapis"
      >
        <UserCog className="w-3.5 h-3.5" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed bg-white border border-[#DCE8F2] rounded-xl shadow-lg z-[100] overflow-hidden"
        >
          <div className="px-4 pt-3 pb-2 border-b border-[#DCE8F2]">
            <p className="text-sm font-bold text-[#102F52]">Pindah Akun</p>
            <p className="text-xs text-[#5B6B7D]">Isi evaluasi pasien (SOAP) atas nama terapis</p>
          </div>
          <div className="max-h-[min(360px,60vh)] overflow-y-auto p-2">
            {inTherapistMode && (
              <button
                onClick={() => go('/admin')}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left mb-1"
              >
                <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0"><Shield className="w-4 h-4" /></span>
                <span className="text-sm font-medium text-[#102F52]">Kembali ke Akun Admin</span>
              </button>
            )}
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#1677D2]" /></div>
            ) : therapists.length === 0 ? (
              <p className="text-xs text-[#5B6B7D] text-center py-6">Tidak ada terapis.</p>
            ) : (
              <div>
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#5B6B7D]">Terapis</p>
                {therapists.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => go(`/admin/as-therapist/${t.id}/records`)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0"><Stethoscope className="w-4 h-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#102F52] truncate">{t.name}</span>
                      {t.email && <span className="block text-xs text-[#5B6B7D] truncate">{t.email}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminTherapistSwitcher;
