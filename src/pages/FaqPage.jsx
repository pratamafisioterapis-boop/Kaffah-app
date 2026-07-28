import React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import { BUSINESS } from '@/lib/businessInfo';

const FAQS = [
  {
    q: 'Bagaimana cara booking sesi fisioterapi di Kaffah Physiotherapy?',
    a: 'Anda bisa booking online melalui halaman Booking di situs ini, atau menghubungi kami langsung via WhatsApp untuk konsultasi dan penjadwalan.',
  },
  {
    q: 'Apakah perlu surat rujukan dokter untuk fisioterapi?',
    a: 'Tidak selalu wajib untuk keluhan umum seperti nyeri otot atau sendi. Namun untuk kondisi pasca operasi, disarankan membawa catatan medis atau rekomendasi dokter agar program terapi sesuai dengan prosedur yang telah dijalani.',
  },
  {
    q: 'Apa saja jam operasional klinik?',
    a: `${BUSINESS.hoursDisplay.map((h) => `${h.days}: ${h.hours}`).join('. ')}.`,
  },
  {
    q: 'Apakah tersedia layanan fisioterapi panggilan ke rumah?',
    a: 'Ya, kami menyediakan layanan home care bagi pasien yang sulit mobilisasi ke klinik, seperti lansia atau pasien pasca stroke. Detail layanan dapat dilihat di halaman Home Care.',
  },
  {
    q: 'Di mana lokasi klinik Kaffah Physiotherapy?',
    a: `Klinik kami berada di ${BUSINESS.addressDisplay}. Peta lokasi tersedia di halaman Lokasi.`,
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
};

const FaqPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title="FAQ | Pertanyaan Seputar Fisioterapi di Kaffah Physiotherapy"
        description="Pertanyaan umum seputar booking, jam operasional, rujukan dokter, dan layanan home care di Kaffah Physiotherapy Balikpapan."
        path="/faq"
        schema={faqSchema}
      />
      <Navbar />
      <main>
        <section className="pt-32 pb-16 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Pertanyaan yang Sering Diajukan
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed mb-4">
              Belum menemukan jawaban? Hubungi kami langsung via{' '}
              <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-kaffah-blue hover:underline font-medium">
                WhatsApp
              </a>.
            </p>
          </div>
        </section>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-4">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <h2 className="font-bold text-slate-900 mb-2">{faq.q}</h2>
                <p className="text-slate-600 leading-relaxed text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default FaqPage;
