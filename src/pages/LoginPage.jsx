import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getUser, getPhysiotherapistByUserId } from '@/lib/api';

// Served from /public rather than bundled, so swapping the brand asset
// later is a file replace, not a code change. Only rendered on APP_DOMAIN
// (clinara.id), so this never touches the Kaffah Physiotherapy
// patient-facing brand on the public domain.
const CLINARA_LOGO_URL = '/clinara-logo.png';
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

      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans selection:bg-cyan-500/30">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_#020617_100%)]"></div>
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse duration-[4000ms]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[420px] p-6"
        >
          {/* Main Card — a hairline gradient border (padding trick) sits behind the
              solid card so the edge catches light instead of reading as a flat
              slab, plus a deep, color-tinted shadow for lift off the background. */}
          <div className="rounded-[26px] p-px bg-gradient-to-b from-white/25 via-white/10 to-white/0 shadow-[0_30px_80px_-25px_rgba(14,165,233,0.35)]">
          <div className="bg-slate-900/70 backdrop-blur-2xl rounded-[25px] overflow-hidden relative group">

            {/* Top decorative line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="p-8 sm:p-10">
              {/* Logo Section */}
              <div className="flex flex-col items-center justify-center mb-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="relative mb-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-400/30 to-teal-400/20 blur-3xl rounded-full scale-90"></div>
                  {/* The lockup's wordmark/tagline are dark navy - illegible
                      straight on this dark card, so it sits on its own light
                      panel instead of directly on the glass. */}
                  <div className="relative bg-white/95 rounded-2xl px-6 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                    <img
                      src={CLINARA_LOGO_URL}
                      alt="Clinara — Better Care. Smarter Management."
                      className="w-32"
                    />
                  </div>
                </motion.div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {authError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, mb: 0 }}
                    animate={{ opacity: 1, height: "auto", mb: 24 }}
                    exit={{ opacity: 0, height: 0, mb: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 overflow-hidden"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200 leading-snug">{authError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-5">
                  <div className="group relative">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:bg-slate-900 transition-all outline-none text-sm"
                      placeholder="Email atau Username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                    />
                  </div>

                  <div className="group relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:bg-slate-900 transition-all outline-none text-sm"
                      placeholder="Password"
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-xs text-slate-400 hover:text-cyan-400 transition-colors font-medium"
                    >
                      Lupa Password?
                    </Link>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || isRedirecting || authLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-6 rounded-xl font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
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
            </div>
            
            {/* Footer */}
            <div className="bg-slate-950/30 p-4 text-center border-t border-white/5 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium tracking-wide uppercase">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Authorized Personnel Only</span>
                <span className="mx-1">•</span>
                <span>Secure Encrypted Access</span>
              </div>
            </div>
          </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            &copy; {new Date().getFullYear()} Clinara. All rights reserved.
          </p>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;