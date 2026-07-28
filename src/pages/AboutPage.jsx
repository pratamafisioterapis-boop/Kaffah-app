import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCheck, Activity, HeartHandshake, ArrowRight, MessageCircle } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PageSEO from '@/components/seo/PageSEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BUSINESS } from '@/lib/businessInfo';

const features = [
  {
    icon: UserCheck,
    title: 'Terapis Tersertifikasi',
    description: 'Ditangani oleh fisioterapis lulusan universitas terkemuka dan memiliki SIPF (Surat Izin Praktik Fisioterapis) aktif.',
  },
  {
    icon: HeartHandshake,
    title: 'Pendekatan Personal',
    description: 'Setiap pasien mendapatkan program terapi yang dirancang khusus sesuai kondisi uniknya, bukan program generik.',
  },
  {
    icon: Activity,
    title: 'Evidence-Based',
    description: 'Metode terapi yang kami gunakan mengacu pada penelitian ilmiah dan praktik fisioterapi terkini.',
  },
  {
    icon: ShieldCheck,
    title: 'Aman & Profesional',
    description: 'Prioritas utama kami adalah keamanan pasien dan standar pelayanan profesional di setiap sesi.',
  },
];

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <PageSEO
        title="Tentang Kami | Kaffah Physiotherapy Balikpapan"
        description="Kaffah Physiotherapy adalah klinik fisioterapi di Batu Ampar, Balikpapan Utara dengan terapis bersertifikat SIPF dan pendekatan evidence-based, personal, dan aman."
        path="/tentang-kami"
      />
      <Navbar />
      <main>
        <section className="pt-32 pb-16 bg-gradient-to-br from-blue-50 to-white">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Tentang Kaffah Physiotherapy
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Kami berdedikasi untuk membantu masyarakat Balikpapan kembali bergerak bebas tanpa rasa sakit. Misi kami adalah menyediakan layanan fisioterapi berkualitas tinggi yang mudah diakses dan berpusat pada pasien, ditangani langsung oleh fisioterapis dengan SIPF (Surat Izin Praktik Fisioterapis) aktif.
            </p>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                >
                  <Card className="h-full border-none shadow-lg hover:shadow-xl transition-shadow bg-slate-50 hover:bg-white group">
                    <CardContent className="p-6 flex flex-col items-center text-center h-full">
                      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-kaffah-navy mb-4 group-hover:bg-kaffah-navy group-hover:text-white transition-colors">
                        <feature.icon className="w-7 h-7" />
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 mb-2">{feature.title}</h3>
                      <p className="text-slate-500 text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-slate-50">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Pendekatan Kami</h2>
            <p className="text-slate-600 leading-relaxed">
              Setiap pasien yang datang ke Kaffah Physiotherapy melalui proses asesmen menyeluruh terlebih dahulu — riwayat keluhan, pemeriksaan fisik, dan penentuan tujuan pemulihan — sebelum program terapi ditentukan. Kami percaya penanganan yang tepat dimulai dari diagnosis yang tepat, bukan program terapi generik yang sama untuk semua orang.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Klinik kami berlokasi di {BUSINESS.addressDisplay}, dan melayani pasien dari berbagai wilayah Balikpapan. Bagi pasien yang kesulitan mobilisasi, tersedia juga layanan{' '}
              <Link to="/layanan/home-care" className="text-kaffah-blue hover:underline font-medium">
                fisioterapi panggilan ke rumah (home care)
              </Link>.
            </p>
          </div>
        </section>

        <section className="py-16 bg-kaffah-navy">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Kenali Tim Fisioterapis Kami</h2>
            <p className="text-blue-100 mb-8 max-w-xl mx-auto">
              Lihat profil dan spesialisasi fisioterapis bersertifikat yang menangani pasien di Kaffah Physiotherapy.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/tim-fisioterapis">
                <Button className="h-12 px-8 text-base bg-white text-kaffah-navy hover:bg-blue-50 gap-2">
                  Lihat Tim Kami <ArrowRight className="w-5 h-5" />
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

export default AboutPage;
