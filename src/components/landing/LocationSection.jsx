import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
const LocationSection = () => {
  return <section className="py-16 bg-slate-50 overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} viewport={{
          once: true
        }} transition={{
          duration: 0.6
        }}>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Kunjungi Kami</h2>
            <p className="text-lg text-slate-600">Temukan kami di lokasi berikut</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Contact Info Card */}
          <motion.div initial={{
          opacity: 0,
          x: -30
        }} whileInView={{
          opacity: 1,
          x: 0
        }} viewport={{
          once: true
        }} transition={{
          duration: 0.6,
          delay: 0.2
        }} className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 h-full flex flex-col justify-between">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-kaffah-blue flex-shrink-0">
                   <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Alamat Klinik</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Jl. Telindung, Perumnas Blok 1 RT. 07 NO. 71,<br />
                    Batu Ampar, Balikpapan Utara
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-kaffah-blue flex-shrink-0">
                   <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">WhatsApp</h3>
                  <a href="https://wa.me/6285245965745" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-kaffah-blue transition-colors font-medium block">
                    +62 852 4596 5745
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-kaffah-blue flex-shrink-0">
                   <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Email</h3>
                  <a href="mailto:kaffah.physiotherapy@gmail.com" className="text-slate-600 hover:text-kaffah-blue transition-colors font-medium block">
                    kaffah.physiotherapy@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-kaffah-blue flex-shrink-0">
                   <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Jam Operasional</h3>
                  <p className="text-slate-600">Senin- jumat : 09.00-21.00 | Sabtu : 09.00-17.00</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <a href="https://maps.app.goo.gl/ZDLpkBTMQxoH6PZg9" target="_blank" rel="noopener noreferrer" className="w-full block">
                <Button className="w-full bg-kaffah-navy hover:bg-kaffah-navy/90 text-white gap-2 h-12 text-base shadow-md">
                  <ExternalLink className="w-4 h-4" />
                  Buka di Google Maps
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Map Embed */}
          <motion.div initial={{
          opacity: 0,
          x: 30
        }} whileInView={{
          opacity: 1,
          x: 0
        }} viewport={{
          once: true
        }} transition={{
          duration: 0.6,
          delay: 0.4
        }} className="h-full min-h-[400px] rounded-2xl overflow-hidden shadow-lg border-4 border-white relative z-0 bg-slate-100">
             <iframe src="https://maps.google.com/maps?q=Jl.+Telindung,+Perumnas+Blok+1+RT.+07+NO.+71,+Batu+Ampar,+Balikpapan+Utara&t=&z=15&ie=UTF8&iwloc=&output=embed" width="100%" height="100%" style={{
            border: 0,
            minHeight: '450px'
          }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Lokasi Kaffah Physiotherapy" className="absolute inset-0 w-full h-full"></iframe>
          </motion.div>
        </div>
      </div>
    </section>;
};
export default LocationSection;