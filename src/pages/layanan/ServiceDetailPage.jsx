import React from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import { Button } from '@/components/ui/button';
import { getServiceBySlug, SERVICES } from '@/data/services';
import { BUSINESS } from '@/lib/businessInfo';

const ServiceDetailPage = () => {
  const { slug } = useParams();
  const service = getServiceBySlug(slug);

  if (!service) {
    return <Navigate to="/layanan" replace />;
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: service.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'MedicalTherapy',
    name: service.title,
    description: service.metaDescription,
    provider: { '@id': `${BUSINESS.url}/#business` },
    areaServed: 'Balikpapan',
  };

  const Icon = service.icon;
  const otherServices = SERVICES.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title={service.metaTitle}
        description={service.metaDescription}
        path={`/layanan/${service.slug}`}
        schema={[serviceSchema, faqSchema]}
      />
      <Navbar />
      <main>
        <section className="pt-32 pb-16 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6">
            <nav className="text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-kaffah-blue">Home</Link>
              <span className="mx-2">/</span>
              <Link to="/layanan" className="hover:text-kaffah-blue">Layanan</Link>
              <span className="mx-2">/</span>
              <span className="text-slate-700">{service.title}</span>
            </nav>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-3xl">
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-kaffah-navy mb-6">
                <Icon className="w-7 h-7" />
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">{service.h1}</h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-8">{service.intro}</p>
              <div className="flex flex-wrap gap-4">
                <Link to="/booking">
                  <Button className="h-12 px-8 text-base bg-kaffah-navy hover:bg-kaffah-navy/90 text-white shadow-lg">
                    Booking Sesi Terapi <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="h-12 px-8 text-base border-kaffah-navy text-kaffah-navy hover:bg-blue-50 gap-2">
                    <MessageCircle className="w-5 h-5" /> Konsultasi via WhatsApp
                  </Button>
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Kondisi yang Ditangani</h2>
              <ul className="space-y-3">
                {service.conditions.map((condition, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-kaffah-blue flex-shrink-0 mt-0.5" />
                    <span>{condition}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Proses Terapi</h2>
              <ol className="space-y-6">
                {service.process.map((step, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-kaffah-navy text-white flex items-center justify-center font-bold flex-shrink-0 text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">{step.step}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="py-16 bg-slate-50">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">Pertanyaan Seputar {service.title}</h2>
            <div className="space-y-4">
              {service.faqs.map((faq, idx) => (
                <div key={idx} className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-2">{faq.q}</h3>
                  <p className="text-slate-600 leading-relaxed text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {otherServices.length > 0 && (
          <section className="py-16 bg-white">
            <div className="container mx-auto px-4 md:px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">Layanan Lainnya</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {otherServices.map((other) => (
                  <Link
                    key={other.slug}
                    to={`/layanan/${other.slug}`}
                    className="block p-6 rounded-xl border border-slate-100 hover:border-kaffah-blue/30 hover:shadow-lg transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-kaffah-blue mb-3">
                      <other.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">{other.title}</h3>
                    <p className="text-slate-500 text-sm mb-3">{other.shortDescription}</p>
                    <span className="text-kaffah-navy text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      Selengkapnya <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-16 bg-kaffah-navy">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Siap Memulai Pemulihan?</h2>
            <p className="text-blue-100 mb-8 max-w-xl mx-auto">
              Konsultasikan keluhan Anda dengan fisioterapis bersertifikat kami di Balikpapan Utara.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/booking">
                <Button className="h-12 px-8 text-base bg-white text-kaffah-navy hover:bg-blue-50">
                  Booking Online
                </Button>
              </Link>
              <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="h-12 px-8 text-base border-white text-white hover:bg-white/10 gap-2">
                  <MessageCircle className="w-5 h-5" /> Chat WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ServiceDetailPage;
