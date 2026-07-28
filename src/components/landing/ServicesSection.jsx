import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SERVICES } from '@/data/services';

const services = SERVICES.map((s) => ({
  slug: s.slug,
  icon: s.icon,
  title: s.title,
  description: s.shortDescription,
}));

const ServicesSection = () => {
  return (
    <section id="services" className="py-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Layanan Unggulan Kami</h2>
            <p className="text-slate-600 text-lg">
              Kami menyediakan berbagai layanan fisioterapi komprehensif untuk menangani berbagai kondisi kesehatan Anda.
            </p>
          </div>
          <Link to="/layanan">
            <span className="text-kaffah-navy font-semibold hover:text-kaffah-blue flex items-center gap-2 transition-colors">
              Lihat Semua Layanan <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full border-slate-100 hover:border-kaffah-blue/30 hover:shadow-lg transition-all group duration-300">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-kaffah-blue mb-2 group-hover:scale-110 transition-transform">
                    <service.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl text-slate-900">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-500 leading-relaxed">
                    {service.description}
                  </p>
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
  );
};

export default ServicesSection;