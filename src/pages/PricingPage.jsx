import React, { useEffect } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ArrowRight, Star } from 'lucide-react';

const valueProps = [
  { text: "Harga Transparan" },
  { text: "Paket Fleksibel" },
  { text: "Kualitas Terjamin" },
  { text: "Terapis Berpengalaman" },
  { text: "Hasil Nyata" },
];

const PricingCard = ({ 
  title, 
  price, 
  originalPrice, 
  validity, 
  savings, 
  description, 
  features, 
  isBestValue, 
  isRecovery, 
  isChild,
  badge,
  buttonText = "Pesan Sekarang"
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`relative h-full flex flex-col ${isBestValue ? 'lg:-mt-4 lg:-mb-4 z-10' : ''}`}
    >
      <div 
        className={`
          h-full rounded-2xl p-6 flex flex-col transition-all duration-300 relative overflow-hidden group
          ${isBestValue 
            ? 'bg-white border-2 border-kaffah-blue shadow-xl scale-[1.02] hover:shadow-2xl' 
            : isRecovery 
              ? 'bg-gradient-to-br from-blue-50 to-white border border-blue-100 shadow-lg hover:shadow-xl hover:scale-105'
              : isChild
                ? 'bg-white border-2 border-orange-100 shadow-lg hover:shadow-xl hover:scale-105 hover:border-orange-200'
                : 'bg-white border border-slate-200 shadow-lg hover:shadow-xl hover:scale-105'
          }
        `}
      >
        {isBestValue && (
          <div className="absolute top-0 right-0 bg-kaffah-blue text-white text-xs font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
            Best Value
          </div>
        )}
        
        {badge && (
          <div className={`inline-block mb-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-fit
            ${isChild ? 'bg-orange-100 text-orange-600' : isBestValue ? 'bg-blue-100 text-kaffah-blue' : 'bg-slate-100 text-slate-600'}
          `}>
            {badge}
          </div>
        )}

        <div className="mb-4">
          <h3 className={`text-xl font-bold ${isChild ? 'text-orange-600' : 'text-slate-900'}`}>{title}</h3>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-slate-900">{price}</span>
            {originalPrice && (
              <span className="text-sm text-slate-400 line-through decoration-slate-400">{originalPrice}</span>
            )}
          </div>
          {savings && (
            <p className="text-sm font-semibold text-emerald-600 mt-1 bg-emerald-50 inline-block px-2 py-0.5 rounded">
              {savings}
            </p>
          )}
        </div>

        {validity && (
          <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5">
             <Clock className="w-4 h-4" /> {validity}
          </p>
        )}

        <div className="border-t border-slate-100 my-4"></div>

        <div className="space-y-3 flex-grow mb-6">
            {description && (
                <p className="text-sm text-slate-600 leading-relaxed">
                    {description}
                </p>
            )}
            {features && (
                <ul className="space-y-2">
                    {features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isChild ? 'text-orange-500' : 'text-kaffah-blue'}`} />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>

        <Link to="/booking" className="mt-auto">
          <Button className={`w-full font-semibold transition-all shadow-md hover:shadow-lg
            ${isBestValue 
                ? 'bg-kaffah-blue hover:bg-kaffah-blue/90 text-white h-12' 
                : isChild
                    ? 'bg-orange-500 hover:bg-orange-600 text-white h-11'
                    : isRecovery
                        ? 'bg-blue-600 hover:bg-blue-700 text-white h-11'
                        : 'bg-slate-900 hover:bg-slate-800 text-white h-11'
            }
          `}>
            {buttonText}
          </Button>
        </Link>
      </div>
    </motion.div>
  );
};

const PricingPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>Tarif Layanan - Kaffah Physiotherapy</title>
        <meta name="description" content="Daftar tarif dan paket fisioterapi Kaffah Physiotherapy. Transparan, terjangkau, dan profesional. Pilih paket yang sesuai kebutuhan pemulihan Anda." />
      </Helmet>
      
      <div className="min-h-screen bg-slate-50 font-sans">
        <Navbar />
        
        <main className="pt-24 pb-20">
          <div className="container mx-auto px-4 md:px-6">
            
            {/* Hero Section */}
            <div className="text-center max-w-4xl mx-auto mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                  Tarif Layanan Kaffah Physiotherapy
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Transparan, profesional, dan bernilai — pilih layanan yang sesuai dengan kebutuhan terapi Anda.
                </p>
              </motion.div>
            </div>

            {/* Value Propositions */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-16">
              {valueProps.map((prop, idx) => (
                 <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * idx }}
                    className="flex items-center gap-2 bg-white px-5 py-3 rounded-full shadow-sm border border-slate-100 text-slate-700 font-medium"
                 >
                    <CheckCircle2 className="w-5 h-5 text-kaffah-blue" />
                    {prop.text}
                 </motion.div>
              ))}
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-20">
              
              {/* Card 1: Regular */}
              <PricingCard 
                title="Regular Session"
                price="Rp200.000 / sesi"
                description="Sesi fisioterapi individual dengan pendekatan evidence-based sesuai kondisi pasien."
                features={["Assessment lengkap", "Terapi manual & modalitas", "Exercise therapy"]}
              />

              {/* Card 2: Paket 1 */}
              <PricingCard 
                badge="⭐ Paket 1"
                title="3 Sesi"
                price="Rp530.000"
                originalPrice="Rp600.000"
                savings="💸 Hemat Rp70.000"
                validity="Berlaku 1 bulan"
                description="Ideal untuk keluhan nyeri ringan hingga sedang serta evaluasi terapi awal."
                buttonText="Pesan Sekarang"
              />

              {/* Card 3: Paket 2 (Best Value) */}
              <PricingCard 
                badge="⭐ BEST VALUE"
                title="6 Sesi"
                price="Rp1.000.000"
                originalPrice="Rp1.200.000"
                savings="💸 Hemat Rp200.000"
                validity="Berlaku 3 bulan"
                description="Pilihan paling populer. Cocok untuk pemulihan cedera olahraga & terapi berkelanjutan."
                buttonText="Pesan Sekarang"
                isBestValue={true}
              />

              {/* Card 4: Paket 3 */}
              <PricingCard 
                badge="⭐⭐ Paket 3"
                title="12 Sesi"
                price="Rp1.900.000"
                originalPrice="Rp2.400.000"
                savings="💸 Hemat Rp500.000"
                validity="Berlaku 6 bulan"
                description="Solusi rehabilitasi jangka panjang, kasus kronis, dan pemulihan pasca operasi."
                buttonText="Pesan Sekarang"
              />

              {/* Card 5: Recovery */}
              <PricingCard 
                title="Recovery Treatment"
                price="Rp220.000 / sesi"
                description="Perawatan pemulihan otot dan sendi untuk mempercepat recovery. Cocok untuk pasien aktif dan pasca aktivitas berat."
                buttonText="Pesan Sekarang"
                isRecovery={true}
              />

              {/* Card 6: Paket Anak */}
              <PricingCard 
                badge="🧒 Paket Anak"
                title="Paket Anak (5 Sesi)"
                price="Rp750.000"
                originalPrice="Rp1.000.000"
                savings="💸 Hemat Rp250.000"
                validity="Berlaku 2 bulan"
                description="Pendekatan fisioterapi yang aman, lembut, dan menyenangkan khusus untuk anak-anak."
                buttonText="Pesan Sekarang"
                isChild={true}
              />

            </div>

            {/* CTA Section */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-kaffah-navy to-blue-600 px-6 py-16 md:px-12 text-center shadow-2xl"
            >
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-white">
                        Siap untuk Pulih Lebih Cepat?
                    </h2>
                    <p className="text-blue-100 text-lg md:text-xl leading-relaxed">
                        Jangan tunda kesehatan Anda. Pilih paket yang sesuai dan jadwalkan sesi fisioterapi pertama Anda hari ini.
                    </p>
                    <div className="pt-4">
                        <Link to="/booking">
                            <Button className="h-14 px-10 text-lg bg-white text-kaffah-navy hover:bg-blue-50 font-bold rounded-full shadow-lg transition-transform hover:-translate-y-1">
                                Pesan Sekarang
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </motion.div>

          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default PricingPage;