import { PRAXIS_CLINIC_ID } from '@/lib/clinicIds';

// Perpanjangan paket (pembayaran + kwitansi, tanpa rekap kunjungan). Saat ini hanya Praxis.
// Istilah dibuat per klinik supaya klinik lain nanti bisa memakai sebutannya sendiri.
const TERMS = {
  [PRAXIS_CLINIC_ID]: {
    action: 'Perpanjang Paket',
    dialogTitle: 'Perpanjang Paket',
    dialogDescription: 'Catat pembayaran paket baru. Kwitansi terbit sekarang; masa berlaku dan sesi baru mulai saat pasien datang.',
    submit: 'Catat Pembayaran',
    receiptTitle: 'Kwitansi Perpanjangan Paket',
    receiptButton: 'Kwitansi',
    itemName: (pkgName, sessions) => `${pkgName} (${sessions} sesi)`,
  },
};

export const isRenewalEnabled = (clinicId) => !!clinicId && !!TERMS[clinicId];

export const getRenewalTerms = (clinicId) => TERMS[clinicId] || TERMS[PRAXIS_CLINIC_ID];
