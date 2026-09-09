import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Building2, User, Mail, Phone, Lock, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';

const initialForm = {
  clinic_name: '',
  owner_full_name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
};

const Field = ({ icon: Icon, ...props }) => (
  <div className="group relative">
    <Icon className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-clinara-teal transition-colors" />
    <input
      {...props}
      className="w-full pl-12 pr-4 py-3 bg-clinara-bg border border-slate-200 rounded-xl text-clinara-navy placeholder:text-slate-400 focus:border-clinara-teal focus:ring-1 focus:ring-clinara-teal transition-all outline-none text-sm"
    />
  </div>
);

const RegisterClinicPage = () => {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.clinic_name.trim() || !form.owner_full_name.trim() || !form.email.trim() || !form.password) {
      setError('Nama klinik, nama pemilik, email, dan password wajib diisi.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/register-clinic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
        body: JSON.stringify({
          clinic_name: form.clinic_name.trim(),
          owner_full_name: form.owner_full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          password: form.password,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal mendaftarkan klinik. Silakan coba lagi.');
      }

      const { error: signInError } = await signIn(form.email.trim(), form.password);
      if (signInError) {
        // Account was created successfully even if auto-login fails — send them to /login instead.
        navigate('/login', { replace: true, state: { registered: true } });
        return;
      }
      navigate('/owner', { replace: true });
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Daftarkan Klinik — Clinara</title>
        <meta name="description" content="Daftarkan klinik Anda di Clinara dan langsung coba gratis 7 hari. Website, booking online, dan dashboard lengkap aktif saat itu juga." />
        <meta name="theme-color" content="#0f2a4a" />
      </Helmet>

      <div className="min-h-screen w-full flex items-center justify-center bg-clinara-bg relative overflow-hidden font-sans px-4 py-10">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-clinara-teal/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-24 w-80 h-80 bg-clinara-sky/20 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="bg-white shadow-xl border border-slate-100 rounded-3xl overflow-hidden">
            <div className="p-8">
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight text-clinara-navy">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-clinara-sky to-clinara-teal flex items-center justify-center text-white text-sm font-black">
                    C
                  </span>
                  Clinara
                </span>
                <h1 className="mt-4 text-2xl font-bold text-clinara-navy">Daftarkan Klinik Anda</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Coba gratis 7 hari. Aktif saat itu juga, tanpa kartu kredit.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 leading-snug">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field icon={Building2} type="text" value={form.clinic_name} onChange={setField('clinic_name')} placeholder="Nama Klinik" required />
                <Field icon={User} type="text" value={form.owner_full_name} onChange={setField('owner_full_name')} placeholder="Nama Lengkap Pemilik" required />
                <Field icon={Mail} type="email" value={form.email} onChange={setField('email')} placeholder="Email" autoCapitalize="none" autoCorrect="off" required />
                <Field icon={Phone} type="tel" value={form.phone} onChange={setField('phone')} placeholder="No. Telepon (opsional)" />
                <Field icon={Lock} type="password" value={form.password} onChange={setField('password')} placeholder="Password (min. 6 karakter)" required />
                <Field icon={Lock} type="password" value={form.confirm_password} onChange={setField('confirm_password')} placeholder="Konfirmasi Password" required />

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-clinara-navy hover:bg-clinara-blue text-white py-6 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> <span>Mendaftarkan klinik...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Daftarkan Klinik</span> <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-clinara-teal" /> Gratis mendaftar</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-clinara-teal" /> Aktif saat itu juga</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-clinara-teal" /> Tanpa kontrak jangka panjang</span>
              </div>
            </div>

            <div className="bg-clinara-bg p-4 text-center border-t border-slate-100">
              <p className="text-sm text-slate-600">
                Sudah punya akun?{' '}
                <Link to="/login" className="font-semibold text-clinara-navy hover:text-clinara-blue">
                  Masuk ke Akun
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default RegisterClinicPage;
