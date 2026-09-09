import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

const CLINARA_LOGO_URL = 'https://dqkejdamagvlhqvxaqej.supabase.co/storage/v1/object/public/images/assets/file_00000000d4908211acc2dbc9fb3a06ab.png';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setSubmitted(true);
    } catch (err) {
      console.error('[ForgotPasswordPage] Reset request failed:', err);
      setError(err.message || 'Gagal mengirim email reset password. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Lupa Password - Clinara</title>
        <meta name="description" content="Reset password akun Clinara" />
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
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="p-8 sm:p-10">
              <div className="flex flex-col items-center justify-center mb-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="w-24 h-24 mb-6 relative"
                >
                  <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full"></div>
                  <div className="relative w-full h-full bg-gradient-to-br from-clinara-sky to-clinara-teal rounded-2xl border border-white/10 shadow-lg flex items-center justify-center overflow-hidden">
                    <span className="text-white text-4xl font-black">C</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <h1 className="text-2xl font-bold text-white tracking-tight">Lupa Password</h1>
                  <p className="text-slate-400 text-sm mt-1.5 font-medium">
                    Masukkan email Anda untuk menerima link reset password
                  </p>
                </motion.div>
              </div>

              {error && (
                <div className="p-3 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200 leading-snug">{error}</p>
                </div>
              )}

              {submitted ? (
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-200 leading-snug">
                      Jika email <span className="font-semibold">{email}</span> terdaftar, kami telah mengirimkan
                      link reset password. Silakan cek inbox atau folder spam Anda.
                    </p>
                  </div>
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Kembali ke Login</span>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="group relative">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:bg-slate-900 transition-all outline-none text-sm"
                      placeholder="Email terdaftar"
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
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
                          <span>Mengirim...</span>
                        </div>
                      ) : (
                        <span>Kirim Link Reset Password</span>
                      )}
                    </Button>
                  </div>

                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors font-medium pt-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Kembali ke Login</span>
                  </Link>
                </form>
              )}
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

export default ForgotPasswordPage;
