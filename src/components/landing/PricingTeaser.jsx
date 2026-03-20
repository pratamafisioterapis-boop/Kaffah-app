import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const PricingTeaser = () => {
  const benefits = [
    "Harga Transparan",
    "Paket Fleksibel",
    "Kualitas Terjamin",
    "Terapis Berpengalaman",
    "Hasil Nyata"
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-kaffah-navy to-blue-600 text-white overflow-hidden relative">
      {/* Abstract Background Pattern */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:w-1/2 space-y-6"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-100 text-sm font-medium backdrop-blur-sm">
              Penawaran Terbaik
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              Tarif Layanan Kaffah Physiotherapy
            </h2>
            
            <p className="text-lg md:text-xl text-blue-100 max-w-xl">
              Transparan, profesional, dan bernilai — pilih layanan yang sesuai dengan kebutuhan terapi Anda. Kami menawarkan berbagai paket terapi dengan harga terjangkau dan fleksibel.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {benefits.map((benefit, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-center gap-3"
                >
                  <div className="bg-white/20 p-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-white">{benefit}</span>
                </motion.div>
              ))}
            </div>
            
            <div className="pt-6">
              <Link to="/pricing">
                <Button className="h-14 px-8 text-lg bg-white text-kaffah-navy hover:bg-blue-50 font-bold rounded-full shadow-lg transition-transform hover:-translate-y-1">
                  Lihat Semua Tarif
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:w-1/2 w-full"
          >
             <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl relative overflow-hidden group hover:bg-white/15 transition-all duration-500">
                <div className="absolute top-0 right-0 p-4 opacity-50">
                   <div className="w-24 h-24 bg-blue-400 rounded-full blur-3xl"></div>
                </div>
                
                <div className="relative z-10 text-center space-y-4">
                   <h3 className="text-2xl font-bold text-white mb-2">Mulai Perjalanan Kesembuhan Anda</h3>
                   <p className="text-blue-100 mb-6">
                      Investasikan kesehatan Anda dengan paket terapi yang komprehensif. Dapatkan penanganan one-on-one dari ahli fisioterapi kami.
                   </p>
                   
                   <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-blue-200">
                      <span className="px-3 py-1 bg-white/10 rounded-full">Sesi Regular</span>
                      <span className="px-3 py-1 bg-white/10 rounded-full">Paket Hemat</span>
                      <span className="px-3 py-1 bg-white/10 rounded-full">Home Care</span>
                      <span className="px-3 py-1 bg-white/10 rounded-full">Pediatric</span>
                   </div>
                </div>
             </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default PricingTeaser;