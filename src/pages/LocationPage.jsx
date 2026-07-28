import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import LocationSection from '@/components/landing/LocationSection';
import { BUSINESS } from '@/lib/businessInfo';

const LocationPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title="Lokasi Kaffah Physiotherapy | Fisioterapi Balikpapan Utara"
        description={`Kaffah Physiotherapy berlokasi di ${BUSINESS.addressDisplay}. Lihat peta, jam operasional, dan cara menghubungi kami.`}
        path="/lokasi"
      />
      <Navbar />
      <main>
        <section className="pt-32 pb-8 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Lokasi Kaffah Physiotherapy
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Klinik kami berada di {BUSINESS.addressDisplay}, melayani pasien dari seluruh wilayah Balikpapan. Bagi pasien yang sulit mobilisasi ke klinik, tersedia layanan{' '}
              <Link to="/layanan/home-care" className="text-kaffah-blue hover:underline font-medium">fisioterapi panggilan ke rumah</Link>.
            </p>
          </div>
        </section>
        <LocationSection />
      </main>
      <Footer />
    </div>
  );
};

export default LocationPage;
