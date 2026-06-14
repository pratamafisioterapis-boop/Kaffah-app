import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
const HeroSection = () => {
  return <section id="home" className="relative min-h-screen flex items-center pt-20 pb-12 overflow-hidden bg-gradient-to-br from-blue-50 to-white">
      {/* Background Shapes */}
      <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-blue-100/50 to-transparent skew-x-12 translate-x-1/4 z-0 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Text Content */}
          <motion.div initial={{
          opacity: 0,
          x: -50
        }} animate={{
          opacity: 1,
          x: 0
        }} transition={{
          duration: 0.8,
          ease: "easeOut"
        }} className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-kaffah-navy text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-kaffah-blue animate-pulse"></span>
              Profesional & Terpercaya
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
              Solusi Fisioterapi <span className="text-kaffah-navy">Profesional</span> untuk Gerak Lebih <span className="text-kaffah-blue">Nyaman</span>
            </h1>
            
            <p className="text-lg text-slate-600 max-w-xl">
              Kembalikan kualitas hidup Anda dengan pendekatan evidence-based physiotherapy yang personal, aman, dan ditangani langsung oleh terapis bersertifikasi.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
               <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-kaffah-blue" />
                  <span>Penanganan Cedera</span>
               </div>
               <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-kaffah-blue" />
                  <span>Pemulihan Pasca Operasi</span>
               </div>
               <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-kaffah-blue" />
                  <span>Home Care</span>
               </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-4">
              <Link to="/booking">
                <Button className="h-12 px-8 text-lg bg-kaffah-navy hover:bg-kaffah-navy/90 text-white shadow-lg hover:shadow-xl transition-all">
                  Booking Online Sekarang
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/6285245965745" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="h-12 px-8 text-lg border-kaffah-navy text-kaffah-navy hover:bg-blue-50 gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Konsultasi Dulu
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Image Content */}
          <motion.div initial={{
          opacity: 0,
          y: 50
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.8,
          delay: 0.2,
          ease: "easeOut"
        }} className="relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] lg:aspect-square">
              <img
  src="https://dqkejdamagvlhqvxaqej.supabase.co/storage/v1/object/public/clinic-assets/landing%20page/20241021_211220_1.jpg"
  alt="Fisioterapi Profesional"
  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
/>
              <div className="absolute inset-0 bg-gradient-to-t from-kaffah-navy/60 to-transparent pointer-events-none" />
              
              <div className="absolute bottom-6 left-6 right-6 text-white">
                 <p className="font-bold text-lg">Pelayanan Terbaik</p>
                 <p className="text-sm text-blue-100">Fokus pada pemulihan maksimal pasien</p>
              </div>
            </div>

            {/* Floating Card */}
            <motion.div initial={{
            opacity: 0,
            scale: 0.8
          }} animate={{
            opacity: 1,
            scale: 1
          }} transition={{
            delay: 0.6
          }} className="absolute -bottom-6 -left-6 md:bottom-10 md:-left-10 bg-white p-4 rounded-xl shadow-xl border border-blue-50 flex items-center gap-4 max-w-[200px]">
               <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                  4.9
               </div>
               <div>
                  <p className="font-bold text-slate-900">Rating Tinggi</p>
                  <p className="text-xs text-slate-500">Dari pasien puas</p>
               </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>;
};
export default HeroSection;