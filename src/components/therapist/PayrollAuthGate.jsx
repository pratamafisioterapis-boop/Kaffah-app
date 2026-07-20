import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { sendPayrollAccessCode, verifyPayrollAccessCode } from '@/lib/payrollOtpClient';

const SESSION_TTL_MS = 30 * 60 * 1000; // berlaku 30 menit, disimpan di localStorage supaya tidak hilang saat tab di-reload/background
const RESEND_COOLDOWN_S = 60;

const sessionKey = (therapistId) => `kaffah_payroll_otp_verified_${therapistId}`;

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '-';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || ''}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
};

const isSessionValid = (therapistId) => {
  const raw = localStorage.getItem(sessionKey(therapistId));
  if (!raw) return false;
  const expiresAt = parseInt(raw, 10);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
};

const PayrollAuthGate = ({ therapist, children }) => {
  const { toast } = useToast();
  const [verified, setVerified] = useState(() => (therapist?.id ? isSessionValid(therapist.id) : false));
  const [step, setStep] = useState('idle'); // idle | sent
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef(null);

  useEffect(() => {
    return () => clearInterval(cooldownTimer.current);
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_S);
    clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!therapist?.email) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Email terapis belum terdaftar. Hubungi admin klinik.' });
      return;
    }
    setSending(true);
    const { error } = await sendPayrollAccessCode(therapist.email);
    setSending(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Mengirim Kode', description: error.message });
      return;
    }
    setStep('sent');
    setCode('');
    startCooldown();
    toast({ title: 'Kode Terkirim', description: `Kode verifikasi telah dikirim ke ${maskEmail(therapist.email)}.` });
  };

  const handleVerify = async () => {
    if (code.length < 6) return;
    setVerifying(true);
    const { error } = await verifyPayrollAccessCode(therapist.email, code);
    setVerifying(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Kode Salah', description: 'Kode verifikasi tidak valid atau sudah kedaluwarsa.' });
      setCode('');
      return;
    }

    localStorage.setItem(sessionKey(therapist.id), String(Date.now() + SESSION_TTL_MS));
    setVerified(true);
    toast({ title: 'Terverifikasi', description: 'Payroll Anda sudah bisa diakses.' });
  };

  if (verified) return children;

  return (
    <div className="flex justify-center py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Verifikasi Diperlukan</h3>
              <p className="text-sm text-slate-500 mt-1">
                Untuk membuka Payroll, masukkan kode verifikasi yang dikirim ke email Anda
                {therapist?.email && <> (<span className="font-medium text-slate-600">{maskEmail(therapist.email)}</span>)</>}.
              </p>
            </div>

            {step === 'idle' ? (
              <Button onClick={handleSendCode} disabled={sending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Kirim Kode ke Email
              </Button>
            ) : (
              <div className="space-y-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Masukkan kode dari email"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-[0.3em]"
                  maxLength={12}
                  autoFocus
                />
                <Button onClick={handleVerify} disabled={verifying || code.length < 6} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Verifikasi
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={sending || cooldown > 0}
                  className="w-full text-slate-500"
                >
                  {cooldown > 0 ? `Kirim Ulang (${cooldown}s)` : 'Kirim Ulang Kode'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default PayrollAuthGate;
