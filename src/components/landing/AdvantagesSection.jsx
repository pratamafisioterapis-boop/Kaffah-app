import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ClipboardCheck, Clock, Smile, Shield } from 'lucide-react';

const advantages = [
  {
    icon: ClipboardCheck,
    text: "Assessment klinis yang menyeluruh dan mendetail."
  },
  {
    icon: CheckCircle2,
    text: "Program terapi yang disesuaikan dengan kebutuhan spesifik pasien."
  },
  {
    icon: Clock,
    text: "Fokus pada hasil jangka panjang, bukan hanya pereda nyeri sesaat."
  },
  {
    icon: Smile,
    text: "Sistem booking online yang mudah, cepat, dan transparan."
  },
  {
    icon: Shield,
    text: "Menjamin privasi, keamanan, dan kenyamanan setiap pasien."
  }
];

const AdvantagesSection = () => {
  return (
    <section className="py-20 bg-kaffah-navy text-white relative overflow-hidden">
      {/* Decorative Circles */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-kaffah-blue/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              Mengapa Memilih <br />
              <span className="text-kaffah-blue">Kaffah Physiotherapy?</span>
            </h2>
            <p className="text-slate-300 text-lg mb-8 max-w-lg">
              Kami tidak hanya menangani gejala, tapi mencari akar masalah untuk memberikan solusi kesehatan gerak yang komprehensif dan berkelanjutan bagi Anda.
            </p>
            <div className="p-6 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
               <div className="text-4xl font-bold text-kaffah-blue mb-2">98%</div>
               <p className="text-slate-200">Pasien merasa puas dengan pelayanan dan hasil terapi yang diberikan.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-white text-slate-900 p-8 rounded-3xl shadow-2xl"
          >
            <ul className="space-y-6">
              {advantages.map((adv, index) => (
                <li key={index} className="flex items-start gap-4 group">
                  <div className="mt-1 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-kaffah-blue group-hover:text-white transition-colors">
                    <adv.icon className="w-5 h-5 text-kaffah-blue group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-lg font-medium text-slate-700 leading-snug">{adv.text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AdvantagesSection;