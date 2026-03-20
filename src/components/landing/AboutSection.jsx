import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCheck, Activity, HeartHandshake } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: UserCheck,
    title: "Terapis Tersertifikasi",
    description: "Ditangani oleh fisioterapis lulusan universitas terkemuka dan memiliki STR aktif."
  },
  {
    icon: HeartHandshake,
    title: "Pendekatan Personal",
    description: "Setiap pasien mendapatkan program terapi yang dirancang khusus sesuai kondisi uniknya."
  },
  {
    icon: Activity,
    title: "Evidence-Based",
    description: "Metode terapi yang kami gunakan selalu berbasis pada penelitian ilmiah terkini."
  },
  {
    icon: ShieldCheck,
    title: "Aman & Profesional",
    description: "Prioritas utama kami adalah keamanan pasien dan standar pelayanan profesional."
  }
];

const AboutSection = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Tentang Kaffah Physiotherapy</h2>
          <p className="text-lg text-slate-600">
            Kami berdedikasi untuk membantu Anda kembali bergerak bebas tanpa rasa sakit. Misi kami adalah menyediakan layanan fisioterapi berkualitas tinggi yang mudah diakses dan berpusat pada pasien.
          </p>
        </div>

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
  );
};

export default AboutSection;