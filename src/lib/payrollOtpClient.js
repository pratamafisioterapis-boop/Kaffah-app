import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

// Klien Supabase terpisah, khusus untuk kode verifikasi payroll terapis.
// persistSession: false supaya proses kirim/verifikasi OTP di sini tidak
// pernah menyentuh sesi login utama terapis di localStorage.
const payrollOtpClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const sendPayrollAccessCode = async (email) => {
  if (!email) return { error: { message: 'Email terapis tidak ditemukan.' } };
  const { error } = await payrollOtpClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  return { error };
};

export const verifyPayrollAccessCode = async (email, code) => {
  if (!email || !code) return { error: { message: 'Kode verifikasi wajib diisi.' } };
  const { error } = await payrollOtpClient.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  // Sesi hasil verifikasi tidak dibutuhkan, langsung dibuang.
  if (!error) await payrollOtpClient.auth.signOut();
  return { error };
};
