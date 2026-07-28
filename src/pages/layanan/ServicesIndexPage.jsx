import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SERVICES } from '@/data/services';

const ServicesIndexPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title="Layanan Fisioterapi di Balikpapan | Kaffah Physiotherapy"
        description="Daftar layanan fisioterapi Kaffah Physiotherapy di Balikpapan Utara: nyeri otot & sendi, cedera olahraga, rehabilitasi pasca operasi, neuromuskular, terapi ergonomis, dan home care."
        path="/layanan"
      />
      <Navbar />
      <main>
        <section className="pt-32 pb-16 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Layanan Fisioterapi di Balikpapan
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Kaffah Physiotherapy menyediakan layanan fisioterapi komprehensif dengan pendekatan evidence-based, ditangani oleh terapis bersertifikat SIPF di Balikpapan Utara.
            </p>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SERVICES.map((service, index) => (
                <motion.div
                  key={service.slug}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="h-full border-slate-100 hover:border-kaffah-blue/30 hover:shadow-lg transition-all group duration-300">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-kaffah-blue mb-2 group-hover:scale-110 transition-transform">
                        <service.icon className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl text-slate-900">{service.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-500 leading-relaxed">{service.shortDescription}</p>
                    </CardContent>
                    <CardFooter>
                      <Link to={`/layanan/${service.slug}`} className="text-kaffah-navy font-medium text-sm hover:text-kaffah-blue flex items-center gap-1 group-hover:gap-2 transition-all">
                        Selengkapnya <ArrowRight className="w-4 h-4" />
                      </Link>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ServicesIndexPage;
