import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';

const CLINARA_LOGO_URL = '/clinara-logo.png';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();

  // Supabase menaruh access_token/refresh_token recovery di URL hash lalu
  // memicu event PASSWORD_RECOVERY setelah sesi dibentuk (detectSessionInUrl: true).
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsReady(true);
      } else if (event === 'SIGNED_IN' && session) {
        setIsReady(true);
      }
    });

    // Fallback: jika session recovery sudah terbentuk sebelum listener terpasang
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data?.session) {
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess(true);
      toast({
        title: 'Password Berhasil Diubah',
        description: 'Silakan login dengan password baru Anda.',
        className: 'bg-emerald-600 text-white border-none',
      });

      await supabase.auth.signOut();
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      console.error('[ResetPasswordPage] Update password failed:', err);
      setError(err.message || 'Gagal mengubah password. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reset Password - Clinara</title>
        <meta name="description" content="Buat password baru untuk akun Clinara" />
        <link rel="icon" type="image/png" href={CLINARA_LOGO_URL} />
        <link rel="apple-touch-icon" href={CLINARA_LOGO_URL} />
        <link rel="manifest" href="/manifest-clinara.json" />
      </Helmet>

      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans selection:bg-cyan-500/30">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_#020617_100%)]"></div>
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse duration-[4000ms]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[420px] p-6"
        >
          <div className="rounded-[26px] p-px bg-gradient-to-b from-white/25 via-white/10 to-white/0 shadow-[0_30px_80px_-25px_rgba(14,165,233,0.35)]">
          <div className="bg-slate-900/70 backdrop-blur-2xl rounded-[25px] overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="p-8 sm:p-10">
              <div className="flex flex-col items-center justify-center mb-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="relative mb-4"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-400/30 to-teal-400/20 blur-3xl rounded-full scale-90"></div>
                  <img
                    src={CLINARA_LOGO_URL}
                    alt="Clinara — Better Care. Smarter Management."
                    className="relative w-28 drop-shadow-[0_12px_28px_rgba(45,212,191,0.25)]"
                  />
                </motion.div>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
                  <p className="text-slate-400 text-sm mt-1.5 font-medium">Buat password baru untuk akun Anda</p>
                </motion.div>
              </div>

              {error && (
                <div className="p-3 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200 leading-snug">{error}</p>
                </div>
              )}

              {success ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-200 leading-snug">
                    Password berhasil diubah. Mengarahkan ke halaman login...
                  </p>
                </div>
              ) : !isReady ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  <p className="text-sm text-slate-400 text-center leading-snug">
                    Memvalidasi link reset password. Jika halaman ini tidak berubah, link mungkin sudah
                    kedaluwarsa — silakan minta link baru.
                  </p>
                  <Link
                    to="/forgot-password"
                    className="flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Minta Link Baru</span>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="group relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:bg-slate-900 transition-all outline-none text-sm"
                      placeholder="Password baru"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="group relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:bg-slate-900 transition-all outline-none text-sm"
                      placeholder="Konfirmasi password baru"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-6 rounded-xl font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Menyimpan...</span>
                        </div>
                      ) : (
                        <span>Simpan Password Baru</span>
                      )}
                    </Button>
                  </div>
                </form>
              )}
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

export default ResetPasswordPage;
