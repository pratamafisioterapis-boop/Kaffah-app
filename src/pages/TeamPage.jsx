import React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import TherapistsSection from '@/components/landing/TherapistsSection';

const TeamPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title="Tim Fisioterapis Balikpapan | Kaffah Physiotherapy"
        description="Kenali tim fisioterapis bersertifikat STR di Kaffah Physiotherapy, Balikpapan Utara. Berpengalaman menangani nyeri otot & sendi, cedera olahraga, hingga neuromuskular."
        path="/tim-fisioterapis"
      />
      <Navbar />
      <main className="pt-20">
        <section className="pt-12 pb-4 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
              Tim Fisioterapis Kaffah Physiotherapy
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Ditangani oleh fisioterapis dengan STR (Surat Tanda Registrasi) aktif dan pengalaman klinis di Balikpapan.
            </p>
          </div>
        </section>
        <TherapistsSection />
      </main>
      <Footer />
    </div>
  );
};

export default TeamPage;
