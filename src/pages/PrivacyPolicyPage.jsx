import React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import { BUSINESS } from '@/lib/businessInfo';

const SECTIONS = [
  {
    title: '1. Tentang Kebijakan Ini',
    body: [
      `Kebijakan Privasi ini menjelaskan bagaimana ${BUSINESS.name} ("kami") mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi pasien, staf, dan pengguna aplikasi manajemen klinik kami (situs kaffahphysio.id dan aplikasi terkait).`,
    ],
  },
  {
    title: '2. Data yang Kami Kumpulkan',
    list: [
      'Data identitas dan kontak pasien: nama, nomor rekam medis, tanggal lahir, nomor telepon/WhatsApp, dan alamat.',
      'Data layanan klinik: jadwal kunjungan, paket terapi, catatan pemeriksaan fisioterapi (SOAP), dan rekam medis.',
      'Data keuangan klinik: transaksi, pemasukan, dan pengeluaran.',
      'Data akun staf dan pengguna: nama, alamat email, dan peran dalam aplikasi.',
    ],
  },
  {
    title: '3. Tujuan Penggunaan Data',
    list: [
      'Memberikan dan mengelola layanan fisioterapi, termasuk penjadwalan dan pencatatan medis.',
      'Menghubungi pasien terkait jadwal, pengingat, dan tindak lanjut terapi.',
      'Pencatatan administrasi dan keuangan klinik.',
      'Menjaga keamanan akun dan mencegah penyalahgunaan aplikasi.',
    ],
  },
  {
    title: '4. Penggunaan Data Pengguna Google (Google Drive dan Google Sheets)',
    body: [
      'Aplikasi kami dapat dihubungkan oleh pemilik klinik ke akun Google miliknya melalui Google OAuth. Setelah diizinkan, aplikasi hanya menggunakan akses tersebut untuk dua fungsi:',
    ],
    list: [
      'Google Drive: menyimpan file yang diunggah terapis (misalnya foto, dokumen, dan video edukasi) ke folder Drive klinik yang ditentukan pemilik, serta menampilkan atau menghapus file tersebut atas permintaan pemilik.',
      'Google Sheets: membuat dan memperbarui satu spreadsheet cadangan berisi salinan data klinik terpilih, sebagai cadangan apabila terjadi masalah pada aplikasi.',
    ],
    after: [
      'Token akses Google disimpan secara aman di server kami dan hanya dipakai untuk fungsi di atas. Kami tidak menggunakan data Google untuk iklan, tidak menjual atau mentransfer data tersebut kepada pihak ketiga, dan tidak membiarkan manusia membacanya kecuali dengan persetujuan pemilik, untuk keperluan keamanan, atau jika diwajibkan hukum.',
      'Penggunaan dan pengalihan informasi yang diterima dari Google API oleh aplikasi kami mematuhi Kebijakan Data Pengguna Layanan Google API (Google API Services User Data Policy), termasuk persyaratan Penggunaan Terbatas (Limited Use).',
      'Pemilik klinik dapat mencabut akses kapan saja melalui pengaturan akun Google di myaccount.google.com/permissions atau dengan menghubungi kami.',
    ],
  },
  {
    title: '5. Penyimpanan dan Keamanan',
    body: [
      'Data disimpan pada layanan basis data terkelola dengan kontrol akses berbasis peran, sehingga staf hanya dapat melihat data sesuai kewenangannya. Koneksi ke aplikasi dienkripsi melalui HTTPS. Meski kami menerapkan langkah pengamanan yang wajar, tidak ada sistem yang sepenuhnya bebas risiko.',
    ],
  },
  {
    title: '6. Pembagian Data',
    body: [
      'Kami tidak menjual data pribadi. Data hanya dibagikan kepada penyedia layanan teknis yang membantu menjalankan aplikasi (misalnya hosting, basis data, dan layanan pesan), serta kepada pihak berwenang bila diwajibkan oleh hukum.',
    ],
  },
  {
    title: '7. Retensi Data',
    body: [
      'Data rekam medis dan administrasi disimpan selama diperlukan untuk pelayanan dan sesuai ketentuan peraturan yang berlaku. Anda dapat meminta penghapusan atau koreksi data sejauh tidak bertentangan dengan kewajiban penyimpanan rekam medis.',
    ],
  },
  {
    title: '8. Hak Anda',
    body: [
      'Anda berhak meminta akses, koreksi, atau penghapusan data pribadi Anda, serta menarik persetujuan yang pernah diberikan. Hubungi kami melalui kontak di bawah.',
    ],
  },
  {
    title: '9. Perubahan Kebijakan',
    body: [
      'Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Versi terbaru selalu tersedia di halaman ini beserta tanggal pembaruannya.',
    ],
  },
];

const PrivacyPolicyPage = () => (
  <div className="min-h-screen bg-white font-sans text-slate-900">
    <PageSEO
      title="Kebijakan Privasi | Kaffah Physiotherapy"
      description="Kebijakan privasi Kaffah Physiotherapy: data yang dikumpulkan, tujuan penggunaan, penggunaan data Google Drive dan Google Sheets, serta hak Anda."
      path="/kebijakan-privasi"
    />
    <Navbar />
    <main>
      <section className="pt-32 pb-10 bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">Kebijakan Privasi</h1>
          <p className="text-slate-500 text-sm">Terakhir diperbarui: 14 November 2026</p>
        </div>
      </section>
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-xl font-bold text-slate-900 mb-3">{s.title}</h2>
              {s.body?.map((p, i) => (
                <p key={i} className="text-slate-600 leading-relaxed mb-3">{p}</p>
              ))}
              {s.list && (
                <ul className="list-disc pl-6 space-y-2 text-slate-600 leading-relaxed mb-3">
                  {s.list.map((li, i) => <li key={i}>{li}</li>)}
                </ul>
              )}
              {s.after?.map((p, i) => (
                <p key={i} className="text-slate-600 leading-relaxed mb-3">{p}</p>
              ))}
            </div>
          ))}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Kontak</h2>
            <p className="text-slate-600 leading-relaxed">
              {BUSINESS.name}<br />
              {BUSINESS.addressDisplay}<br />
              Email: <a href={`mailto:${BUSINESS.email}`} className="text-kaffah-blue hover:underline">{BUSINESS.email}</a><br />
              WhatsApp: <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-kaffah-blue hover:underline">{BUSINESS.whatsappDisplay}</a>
            </p>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default PrivacyPolicyPage;
