import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle } from 'lucide-react';

const CTASection = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-kaffah-navy to-slate-900 text-white relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#5ba3d0 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-3xl mx-auto space-y-8"
            >
                <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                    Mulai Perawatan Anda Sekarang
                </h2>
                <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
                    Jangan biarkan nyeri menghambat aktivitas Anda. Booking sesi fisioterapi dengan mudah melalui sistem online kami dan rasakan perubahannya.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Link to="/booking">
                        <Button className="h-14 px-10 text-lg bg-kaffah-blue hover:bg-kaffah-blue/90 text-white rounded-full shadow-lg shadow-blue-900/20 transform hover:-translate-y-1 transition-all">
                            Booking Online Sekarang
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </Link>
                    <a href="https://wa.me/6285245965745" target="_blank" rel="noopener noreferrer">
                         <Button variant="outline" className="h-14 px-10 text-lg border-white/20 bg-white/5 text-white hover:bg-white/10 rounded-full backdrop-blur-sm gap-2">
                            <MessageCircle className="w-5 h-5" />
                            Konsultasi via WhatsApp
                         </Button>
                    </a>
                </div>
            </motion.div>
        </div>
    </section>
  );
};

export default CTASection;