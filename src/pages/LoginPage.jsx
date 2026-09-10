import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, Mail, Lock, ArrowRight, CheckCircle2, Eye, EyeOff, Fingerprint, ShieldCheck, BarChart3 } from 'lucide-react';
import { getUser, getPhysiotherapistByUserId } from '@/lib/api';

// Served from /public rather than bundled, so swapping the brand asset
// later is a file replace, not a code change. Only rendered on APP_DOMAIN
// (clinara.id), so this never touches the Kaffah Physiotherapy
// patient-facing brand on the public domain.
const CLINARA_LOGO_URL = '/clinara-logo.png';
const CLINARA_LOGIN_BG_URL = '/login-bg.jpg';
// Icon-only crops (see public/clinara-icon.png generation) - the favicon
// needs just the mark with no visible box (browser tabs render transparency
// fine); apple-touch-icon needs an opaque backing since iOS paints
// transparent areas black on home-screen icons.
const CLINARA_ICON_URL = '/clinara-icon.png';
const CLINARA_APP_ICON_URL = '/clinara-icon-app.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle URL errors (e.g. from password reset or magic links)
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.includes('error_description')) {
        const params = new URLSearchParams(hash.substring(1)); // remove #
        const errorDescription = params.get('error_description');
        if (errorDescription) {
            setAuthError(decodeURIComponent(errorDescription).replace(/\+/g, ' '));
            // Clear the hash to clean up URL
            window.history.replaceState(null, '', window.location.pathname);
        }
    }
  }, [location]);

  // Redirect logic
  useEffect(() => {
    let mounted = true;

    const checkUserRoleAndRedirect = async () => {
      // If no user or still loading auth state, do nothing
      if (!user || authLoading) return;
      
      setIsRedirecting(true);
      console.log("[LoginPage] Starting role check for user:", user.id);

      try {
        const { data: userProfile, error } = await getUser(user.id);
        
        if (!mounted) return;

        if (error) {
            console.error("[LoginPage] Error fetching user profile:", error);
        }

        if (error || !userProfile) {
          console.log("[LoginPage] Validating fallback therapist profile...");
          // Fallback: Check if user is a physiotherapist directly
          const { data: physioProfile, error: physioError } = await getPhysiotherapistByUserId(user.id);
          
          if (physioError) {
             console.error("[LoginPage] Error fetching physio profile:", physioError);
          }

          if (physioProfile) {
            console.log("[LoginPage] Found therapist profile, redirecting.");
            navigate('/therapist', { replace: true });
            return;
          }

          console.log("[LoginPage] Checking Rotasi Jadwal admin status...");
          const { data: rotasiAdmin } = await supabase
            .from('rotasi_admins')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (rotasiAdmin) {
            console.log("[LoginPage] Rotasi admin detected, redirecting.");
            navigate('/rotasi', { replace: true });
            return;
          }

          console.log("[LoginPage] Checking Pemilih admin status...");
          const { data: pemilihAdminFallback } = await supabase
            .from('pemilih_admins')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (pemilihAdminFallback) {
            console.log("[LoginPage] Pemilih admin detected, redirecting.");
            navigate('/pemilih', { replace: true });
            return;
          }

          console.log("[LoginPage] Checking Pemilih relawan status...");
          const { data: relawanFallback } = await supabase
            .from('pemilih_relawan')
            .select('user_id, is_active')
            .eq('user_id', user.id)
            .maybeSingle();

          if (relawanFallback?.is_active) {
            console.log("[LoginPage] Pemilih relawan detected, redirecting.");
            navigate('/relawan', { replace: true });
            return;
          }

          console.log("[LoginPage] Checking Pemilih DPC status...");
          const { data: dpcFallback } = await supabase
            .from('pemilih_dpc')
            .select('user_id, is_active')
            .eq('user_id', user.id)
            .maybeSingle();

          if (dpcFallback?.is_active) {
            console.log("[LoginPage] Pemilih DPC detected, redirecting.");
            navigate('/pemilih-dpc', { replace: true });
            return;
          }

          console.log("[LoginPage] Validating fallback metadata role...");
          // Fallback: Check metadata
          const metaRole = user.user_metadata?.role;
          if (metaRole) {
             console.log("[LoginPage] Using metadata role:", metaRole);
             if (metaRole === 'super_admin') navigate('/super-admin', { replace: true });
             else if (metaRole === 'owner') navigate('/owner', { replace: true });
             else if (metaRole === 'admin' || metaRole === 'clinic_admin') navigate('/admin', { replace: true });
             else navigate('/therapist', { replace: true });
             return;
          }

          console.warn("[LoginPage] Account profile not fully initialized.");
          setAuthError("Account profile not fully initialized. Please contact administrator.");
          setIsRedirecting(false);
          return;
        }

        console.log("[LoginPage] Checking Rotasi Jadwal admin status...");
        const { data: rotasiAdmin } = await supabase
          .from('rotasi_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (rotasiAdmin) {
          console.log("[LoginPage] Rotasi admin detected, redirecting.");
          navigate('/rotasi', { replace: true });
          return;
        }

        console.log("[LoginPage] Checking Pemilih admin status...");
        const { data: pemilihAdmin } = await supabase
          .from('pemilih_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (pemilihAdmin) {
          console.log("[LoginPage] Pemilih admin detected, redirecting.");
          navigate('/pemilih', { replace: true });
          return;
        }

        console.log("[LoginPage] Checking Pemilih relawan status...");
        const { data: relawan } = await supabase
          .from('pemilih_relawan')
          .select('user_id, is_active')
          .eq('user_id', user.id)
          .maybeSingle();

        if (relawan?.is_active) {
          console.log("[LoginPage] Pemilih relawan detected, redirecting.");
          navigate('/relawan', { replace: true });
          return;
        }

        console.log("[LoginPage] Checking Pemilih DPC status...");
        const { data: dpc } = await supabase
          .from('pemilih_dpc')
          .select('user_id, is_active')
          .eq('user_id', user.id)
          .maybeSingle();

        if (dpc?.is_active) {
          console.log("[LoginPage] Pemilih DPC detected, redirecting.");
          navigate('/pemilih-dpc', { replace: true });
          return;
        }

        if (userProfile.is_active === false) {
          console.warn("[LoginPage] Account is inactive:", user.id);
          await signOut();
          setAuthError("Akun Anda telah dinonaktifkan. Silakan hubungi administrator.");
          setIsRedirecting(false);
          return;
        }

        const role = userProfile.role?.toLowerCase();
        console.log("[LoginPage] User role determined:", role);
        
        // Brief delay for better UX
        await new Promise(r => setTimeout(r, 300)); 

        // Check if there was a previous location we tried to access
        const from = location.state?.from?.pathname;
        if (from && from !== '/login') {
             console.log("[LoginPage] Redirecting to intended destination:", from);
             navigate(from, { replace: true });
             return;
        }
const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true ||
  document.referrer.includes('android-app://');

// Standard role-based redirect
switch (role) {
  case 'super_admin':
    navigate('/super-admin', { replace: true });
    break;

  case 'owner':
    navigate(
      isPWA ? '/owner/dashboard' : '/owner',
      { replace: true }
    );
    break;

  case 'admin':
case 'clinic_admin':
  navigate('/admin', { replace: true });
  break;

  case 'therapist':
  case 'physiotherapist':
    navigate('/therapist', { replace: true });
    break;

  default:
    // Unknown role
    console.warn("[LoginPage] Unknown role encountered:", role);
    await signOut();
    setAuthError(`Role '${role}' is not authorized to access the system.`);
    setIsRedirecting(false);
}
      } catch (err) {
        if (mounted) {
          console.error("[LoginPage] Critical redirect error:", err);
          setAuthError("Unexpected error occurred during login resolution.");
          setIsRedirecting(false);
        }
      }
    };

    if (user && !authLoading) {
      checkUserRoleAndRedirect();
    }

    return () => {
      mounted = false;
    };
  }, [user, authLoading, navigate, signOut, location.state]);
  

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      // Relawan login pakai username (tanpa "@"), diterjemahkan ke email sintetis
      // yang dibuat saat akunnya dibuat lewat menu Setup > Akun Relawan.
      const loginEmail = email.includes('@')
        ? email
        : `${email.trim().toLowerCase()}@relawan.pemilih.local`;
      const { error } = await signIn(loginEmail, password);
      if (error) {
          throw error;
      }
       const { data: sessionData } = await supabase.auth.getSession();
    console.log("SESSION CHECK:", sessionData);

      // Redirect is handled by useEffect
      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
        className: "bg-emerald-600 text-white border-none"
      });
    } catch (err) {
      console.error("[LoginPage] SignIn failed:", err);
      setAuthError(err.message || "Authentication failed. Please check your credentials.");
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: err.message || "An unexpected error occurred."
      });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Login - Clinara</title>
        <meta name="description" content="Secure login to Clinara — Healthcare Management Platform" />
        <link rel="icon" type="image/png" href={CLINARA_ICON_URL} />
        <link rel="apple-touch-icon" href={CLINARA_APP_ICON_URL} />
        <link rel="manifest" href="/manifest-clinara.json" />
      </Helmet>

      <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-[#2F8CFF]/30">
        {/* Background photo with a navy-to-blue wash so the white card and
            light-colored taglines stay legible over any part of the image. */}
        <div className="absolute inset-0 z-0">
          <img
            src={CLINARA_LOGIN_BG_URL}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a2a52]/85 via-[#0e3a6b]/70 to-[#08284f]/90"></div>
        </div>

        {/* Corner taglines echoing the brand voice, kept subtle behind the card */}
        <div className="absolute top-6 left-6 z-10 text-white/80 text-xs sm:text-sm font-semibold leading-tight max-w-[140px]">
          <span className="block w-6 border-t border-white/50 mb-2"></span>
          Better Care
          <br />
          Smarter Management
        </div>
        <div className="hidden sm:block absolute top-6 right-6 z-10 text-white/70 text-sm italic font-serif text-right leading-tight">
          For a Healthier
          <br />
          Tomorrow
        </div>
        <div className="hidden sm:block absolute top-1/3 right-6 z-10 text-white/70 text-sm font-medium text-right leading-relaxed">
          Move
          <br />
          Recover
          <br />
          Grow
          <br />
          Together
        </div>
        <div className="hidden sm:block absolute bottom-24 right-6 z-10 text-white/70 text-sm italic font-serif text-right leading-tight">
          Care
          <br />
          Manage
          <br />
          Grow
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[420px] px-6 pt-6"
        >
          {/* Logo */}
          <div className="flex flex-col items-center justify-center mb-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="bg-white rounded-3xl px-8 py-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            >
              <img
                src={CLINARA_LOGO_URL}
                alt="Clinara — Better Care. Smarter Management."
                className="w-32"
              />
            </motion.div>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(8,20,45,0.35)]">
            <div className="px-7 pt-7 pb-6 sm:px-8">
              <div className="text-center mb-6">
                <h1 className="text-[#102F52] text-xl font-bold">Selamat Datang Kembali</h1>
                <p className="text-[#5B6B7D] text-sm mt-1">
                  Masuk untuk mengakses dashboard
                  <br />
                  Clinara
                </p>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {authError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 overflow-hidden"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 leading-snug">{authError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-4">
                  <div className="group relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8FA3B8] group-focus-within:text-[#2F8CFF] transition-colors" />
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-[#EAF1F8] border border-transparent rounded-2xl text-[#102F52] placeholder:text-[#8FA3B8] focus:border-[#2F8CFF]/50 focus:ring-2 focus:ring-[#2F8CFF]/20 focus:bg-white transition-all outline-none text-sm"
                      placeholder="Email atau Username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                    />
                  </div>

                  <div className="group relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8FA3B8] group-focus-within:text-[#2F8CFF] transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-11 py-3.5 bg-[#EAF1F8] border border-transparent rounded-2xl text-[#102F52] placeholder:text-[#8FA3B8] focus:border-[#2F8CFF]/50 focus:ring-2 focus:ring-[#2F8CFF]/20 focus:bg-white transition-all outline-none text-sm"
                      placeholder="Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8FA3B8] hover:text-[#2F8CFF] transition-colors"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-xs text-[#1677D2] hover:text-[#2F8CFF] transition-colors font-semibold"
                    >
                      Lupa Password?
                    </Link>
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    disabled={isSubmitting || isRedirecting || authLoading}
                    className="w-full bg-gradient-to-r from-[#0f2a4a] to-[#2F8CFF] hover:from-[#0f2a4a] hover:to-[#1677D2] text-white py-6 rounded-2xl font-semibold shadow-lg shadow-[#1677D2]/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting || isRedirecting || authLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Verifying Access...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span>Sign In to Dashboard</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <span className="flex-1 h-px bg-[#DCE8F2]"></span>
                <span className="text-xs text-[#8FA3B8]">atau</span>
                <span className="flex-1 h-px bg-[#DCE8F2]"></span>
              </div>

              {/* Biometric */}
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#EAF1F8] hover:bg-[#DCE8F2] rounded-2xl text-[#102F52] text-sm font-medium transition-colors"
              >
                <Fingerprint className="w-5 h-5 text-[#1677D2]" />
                <span>Masuk dengan Biometrik</span>
              </button>

              {/* Trust row */}
              <div className="grid grid-cols-3 gap-2 mt-6 text-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="w-9 h-9 rounded-full bg-[#EAF4FF] flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-[#1677D2]" />
                  </span>
                  <span className="text-[10px] text-[#5B6B7D] leading-tight">
                    Authorized
                    <br />
                    Personnel Only
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="w-9 h-9 rounded-full bg-[#EAF4FF] flex items-center justify-center">
                    <Lock className="w-4 h-4 text-[#1677D2]" />
                  </span>
                  <span className="text-[10px] text-[#5B6B7D] leading-tight">
                    Secure Encrypted
                    <br />
                    Access
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="w-9 h-9 rounded-full bg-[#EAF4FF] flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-[#1677D2]" />
                  </span>
                  <span className="text-[10px] text-[#5B6B7D] leading-tight">
                    Trusted by
                    <br />
                    Healthcare Experts
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-white/70 text-xs mt-5 mb-6">
            &copy; {new Date().getFullYear()} Clinara. All rights reserved.
          </p>
        </motion.div>

        {/* Bottom decorative blue accent shapes */}
        <div className="absolute bottom-0 left-0 w-full h-24 sm:h-28 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-10 -left-16 w-[70vw] max-w-[420px] h-40 bg-[#0f2a4a] rotate-[-8deg] rounded-tr-[80px]"></div>
          <div className="absolute -bottom-16 -left-24 w-[55vw] max-w-[340px] h-40 bg-[#1677D2] rotate-[-8deg] rounded-tr-[80px] opacity-90"></div>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/40"></span>
        </div>
      </div>
    </>
  );
};

export default LoginPage;