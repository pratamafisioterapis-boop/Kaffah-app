import { addDays, format, nextMonday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const long = (d) => format(d, 'd MMMM yyyy', { locale: idLocale });

// Nomor SK naik otomatis per tahun: 001/SK/KAFFAH/X/2026.
export const nextDecreeNumber = (existing = [], date = new Date()) => {
  const year = date.getFullYear();
  const count = existing.filter((d) => d.decree_date && new Date(d.decree_date).getFullYear() === year).length + 1;
  return `${String(count).padStart(3, '0')}/SK/KAFFAH/${ROMAN[date.getMonth() + 1]}/${year}`;
};

// SK pertama: masa percobaan SOAP di hari yang sama, lalu aturan penuh mulai
// Senin berikutnya. Semua isi tetap bisa diedit owner sebelum diterbitkan.
export const soapPolicyDecreeTemplate = (date = new Date()) => {
  const start = long(date);
  const fullStart = nextMonday(date);
  const trialEnd = long(addDays(fullStart, -1));
  const full = long(fullStart);
  return {
    title: 'Ketentuan Waktu Pengisian SOAP oleh Terapis',
    considerations: [
      'bahwa SOAP adalah catatan pelayanan yang menjadi bukti bahwa tindakan terapi telah kita berikan dengan tepat, lengkap, dan dapat dipertanggungjawabkan;',
      'bahwa SOAP yang terisi rapi dan tepat waktu menjaga ketertiban administrasi klinik sekaligus melindungi seluruh tim, termasuk para terapis, apabila sewaktu-waktu terdapat pemeriksaan atau sidak administrasi;',
      'bahwa agar seluruh tim dapat menyesuaikan diri dengan tenang, perlu diberikan masa percobaan sebelum ketentuan ini diberlakukan sepenuhnya;',
      'bahwa berdasarkan pertimbangan tersebut, dipandang perlu menetapkan Surat Keputusan tentang ketentuan waktu pengisian SOAP.',
    ],
    decisions: [
      {
        heading: 'KESATU — Masa Percobaan',
        text: `Pada ${start} sampai dengan ${trialEnd} ditetapkan sebagai masa percobaan. Pada masa ini terapis diberi keringanan untuk mengisi SOAP pasien pada hari yang sama, paling lambat pukul 23.59 WIB. Apabila SOAP belum terisi hingga batas tersebut, Booking Calendar terapis akan dikunci sementara, dan dibuka kembali setelah SOAP yang tertinggal dilengkapi. Penguncian ini bersifat pengingat agar catatan kita selalu rapi, bukan sebagai hukuman.`,
      },
      {
        heading: 'KEDUA — Ketentuan Mulai Berlaku Penuh',
        text: `Mulai hari Senin, ${full}, SOAP wajib diisi oleh terapis sebelum pasien melakukan pembayaran.`,
      },
      {
        heading: 'KETIGA — Pasien Paket',
        text: 'Bagi pasien yang mengambil paket terapi, pada sesi ke-2 sampai dengan sesi terakhir tidak ada pembayaran lagi. Untuk sesi tersebut diberikan tenggang waktu pengisian SOAP pada hari yang sama, paling lambat pukul 23.59 WIB.',
      },
      {
        heading: 'KEEMPAT — Konsekuensi',
        text: `Mulai ${full}, apabila SOAP tidak diisi sesuai ketentuan di atas, maka jasa terapis untuk sesi yang SOAP-nya belum terisi tidak dapat diperhitungkan, karena tanpa SOAP pelayanan tersebut belum dapat dibuktikan secara administrasi.`,
      },
      {
        heading: 'KELIMA — Penutup',
        text: 'Surat Keputusan ini berlaku sejak tanggal ditetapkan dan akan ditinjau kembali apabila diperlukan untuk penyempurnaan.',
      },
    ],
    closing: 'Keputusan ini kami susun dengan niat baik dan untuk kebaikan kita bersama, agar pekerjaan para terapis yang sudah dilakukan dengan sungguh-sungguh tercatat dengan baik, jasa terhitung semestinya, dan kita semua aman serta tenang ketika ada pemeriksaan administrasi. Atas perhatian dan kerja samanya, kami mengucapkan terima kasih.',
  };
};
