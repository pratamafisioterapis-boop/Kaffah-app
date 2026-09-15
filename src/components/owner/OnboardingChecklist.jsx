import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Circle, ImageIcon, Building2, Stamp, MapPin, Phone,
  UserPlus, CalendarClock, UserCog, Users, Package, Landmark, ArrowRight,
  Rocket,
} from 'lucide-react';

// Onboarding checklist for a freshly registered clinic — walks a new owner
// through the same "what do I set up first" steps a brand-new app would,
// so the account isn't left half-configured. Re-evaluated (and re-shown)
// on every login until every required step is done; nothing here is
// persisted as "dismissed forever" on purpose.
const STEPS = [
  {
    key: 'splash_photo',
    label: 'Foto Splash Screen',
    required: false,
    desc: 'Foto yang tampil sesaat saat Anda membuka aplikasi. Kalau dilewati, splash screen memakai logo klinik.',
    tab: 'account_clinic',
    icon: ImageIcon,
  },
  {
    key: 'clinic_logo',
    label: 'Logo Klinik',
    required: true,
    desc: 'Tampil di sidebar, dokumen, dan landing page klinik Anda.',
    tab: 'account_clinic',
    icon: Building2,
  },
  {
    key: 'clinic_stamp',
    label: 'Stempel Klinik',
    required: true,
    desc: 'Dipakai otomatis pada invoice dan dokumen resmi klinik.',
    tab: 'account_clinic',
    icon: Stamp,
  },
  {
    key: 'clinic_address',
    label: 'Alamat Klinik',
    required: true,
    desc: 'Tampil di invoice, dokumen, dan landing page klinik.',
    tab: 'account_clinic',
    icon: MapPin,
  },
  {
    key: 'clinic_phone',
    label: 'No. HP Klinik',
    required: true,
    desc: 'Dipakai pasien untuk menghubungi klinik dari landing page/booking.',
    tab: 'account_clinic',
    icon: Phone,
  },
  {
    key: 'therapist',
    label: 'Tambah Terapis',
    required: true,
    desc: 'Wajib ada minimal 1 terapis agar jadwal, booking, dan SOAP bisa berjalan.',
    href: '/owner/physiotherapist-management?tab=list',
    icon: UserPlus,
  },
  {
    key: 'therapist_schedule',
    label: 'Jadwal Praktek Terapis',
    required: true,
    desc: 'Tentukan hari & jam praktek tiap terapis — ini yang membuka slot booking untuk pasien.',
    href: '/owner/physiotherapist-management?tab=schedule',
    icon: CalendarClock,
  },
  {
    key: 'admin',
    label: 'Tambah Admin',
    required: false,
    desc: 'Opsional — beri akun staf front office untuk bantu input transaksi harian.',
    href: '/owner/admin-management',
    icon: UserCog,
  },
  {
    key: 'patient_type',
    label: 'Tipe Pasien',
    required: true,
    desc: 'Kategori pasien (mis. Normal, Homecare, Member). Dipakai saat input Daily Recap dan menentukan tarif jasa/insentif terapis per tipe — kalau kosong, pencatatan transaksi harian tidak bisa dipilih tipenya.',
    tab: 'type',
    icon: Users,
  },
  {
    key: 'package_type',
    label: 'Tipe Paket',
    required: true,
    desc: 'Jenis paket terapi (mis. Paket 10 Sesi) beserta jumlah sesi & masa berlakunya. Dipakai saat pasien beli paket, dan menentukan pelacakan sisa sesi, reminder expiry, serta laporan Package Recap.',
    tab: 'package',
    icon: Package,
  },
  {
    key: 'bank_account',
    label: 'Akun Bank',
    required: true,
    desc: 'Rekening klinik untuk mencatat pemasukan non-tunai (transfer/QRIS) dan rekonsiliasi keuangan.',
    tab: 'bank_accounts',
    icon: Landmark,
  },
];

const OnboardingChecklist = () => {
  const { user, userDetails } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userDetails?.clinic_id || !user?.id) return;
      const clinicId = userDetails.clinic_id;

      const [
        { data: clinic },
        { data: authUser },
        { count: therapistCount },
        { count: scheduleCount },
        { count: adminCount },
        { count: patientTypeCount },
        { count: packageTypeCount },
        { count: bankAccountCount },
      ] = await Promise.all([
        supabase.from('clinics').select('logo_url, stamp_url, address, phone').eq('id', clinicId).single(),
        supabase.from('users').select('avatar_url').eq('id', user.id).single(),
        supabase.from('physiotherapists').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
        supabase.from('therapist_schedules').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('is_active', true),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).in('role', ['admin', 'clinic_admin']),
        supabase.from('operational_options').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('category', 'patient_type'),
        supabase.from('operational_options').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('category', 'tipe_paket'),
        supabase.from('bank_accounts').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      ]);

      if (!active) return;

      const next = {
        splash_photo: !!authUser?.avatar_url,
        clinic_logo: !!clinic?.logo_url,
        clinic_stamp: !!clinic?.stamp_url,
        clinic_address: !!clinic?.address,
        clinic_phone: !!clinic?.phone,
        therapist: (therapistCount || 0) > 0,
        therapist_schedule: (scheduleCount || 0) > 0,
        admin: (adminCount || 0) > 0,
        patient_type: (patientTypeCount || 0) > 0,
        package_type: (packageTypeCount || 0) > 0,
        bank_account: (bankAccountCount || 0) > 0,
      };
      setStatus(next);

      const requiredDone = STEPS.filter((s) => s.required).every((s) => next[s.key]);
      setOpen(!requiredDone);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [user, userDetails]);

  if (loading) return null;

  const requiredSteps = STEPS.filter((s) => s.required);
  const requiredDoneCount = requiredSteps.filter((s) => status[s.key]).length;
  const allRequiredDone = requiredDoneCount === requiredSteps.length;

  if (allRequiredDone) return null;

  const progressPct = Math.round((requiredDoneCount / requiredSteps.length) * 100);

  const goToStep = (step) => {
    setOpen(false);
    if (step.href) navigate(step.href);
    else navigate(`/owner/settings?tab=${step.tab}`);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-clinara-navy text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg hover:bg-clinara-blue transition-colors text-sm font-semibold"
      >
        <Rocket className="w-4 h-4" />
        Setup Awal ({requiredDoneCount}/{requiredSteps.length})
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-clinara-teal" /> Selamat Datang di Clinara!
          </DialogTitle>
          <DialogDescription>
            Lengkapi langkah-langkah berikut agar klinik Anda siap dipakai sepenuhnya. Selama masih ada yang wajib belum diisi, daftar ini akan muncul lagi setiap kali Anda masuk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 my-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Progres wajib</span>
            <span className="font-semibold text-slate-700">{requiredDoneCount}/{requiredSteps.length}</span>
          </div>
          <Progress value={progressPct} indicatorClassName="bg-clinara-teal" />
        </div>

        <div className="space-y-2 mt-2">
          {STEPS.map((step) => {
            const done = !!status[step.key];
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => goToStep(step)}
                className={cn(
                  'w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors',
                  done ? 'bg-emerald-50/60 border-emerald-100' : 'bg-white border-slate-200 hover:border-clinara-teal/50 hover:bg-slate-50'
                )}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className={cn('text-sm font-semibold', done ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-slate-800')}>
                      {step.label}
                    </span>
                    {!step.required && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Opsional</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
                </div>
                {!done && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Tutup dulu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingChecklist;
