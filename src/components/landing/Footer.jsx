import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, MapPin, Phone, Mail } from 'lucide-react';
import { BUSINESS } from '@/lib/businessInfo';
const Footer = () => {
  const currentYear = new Date().getFullYear();
  return <footer id="footer" className="bg-slate-900 text-slate-300 pt-16 pb-8 border-t border-slate-800">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">
              Kaffah <span className="text-kaffah-blue">Physio</span>
            </h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Solusi fisioterapi profesional terpercaya untuk pemulihan gerak dan fungsi tubuh yang optimal. Evidence-based, personal, dan aman.
            </p>
            <div className="flex gap-4 pt-2">
              <a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-kaffah-blue hover:text-white transition-all">
                <Instagram className="w-5 h-5" />
              </a>
              <a href={BUSINESS.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-kaffah-blue hover:text-white transition-all">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold text-white mb-6">Quick Links</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className="hover:text-kaffah-blue transition-colors">Home</Link></li>
              <li><Link to="/tentang-kami" className="hover:text-kaffah-blue transition-colors">Tentang Kami</Link></li>
              <li><Link to="/layanan" className="hover:text-kaffah-blue transition-colors">Layanan</Link></li>
              <li><Link to="/tim-fisioterapis" className="hover:text-kaffah-blue transition-colors">Tim Kami</Link></li>
              <li><Link to="/artikel" className="hover:text-kaffah-blue transition-colors">Artikel</Link></li>
              <li><Link to="/lokasi" className="hover:text-kaffah-blue transition-colors">Lokasi</Link></li>
              <li><Link to="/faq" className="hover:text-kaffah-blue transition-colors">FAQ</Link></li>
              <li><Link to="/pricing" className="hover:text-kaffah-blue transition-colors">Tarif</Link></li>
              <li><Link to="/booking" className="hover:text-kaffah-blue transition-colors">Booking Online</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-bold text-white mb-6">Kontak Kami</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-kaffah-blue flex-shrink-0 mt-0.5" />
                <span>{BUSINESS.addressDisplay}</span>
              </li>
              <li>
                <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-kaffah-blue transition-colors">
                  <Phone className="w-5 h-5 text-kaffah-blue flex-shrink-0" />
                  <span>{BUSINESS.whatsappDisplay}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${BUSINESS.email}`} className="flex items-center gap-3 hover:text-kaffah-blue transition-colors">
                  <Mail className="w-5 h-5 text-kaffah-blue flex-shrink-0" />
                  <span>{BUSINESS.email}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Opening Hours */}
          <div>
            <h4 className="text-lg font-bold text-white mb-6">Jam Operasional :</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span>Senin - Jumat</span>
                <span className="text-white font-medium">09.00-21.00</span>
              </li>
              <li className="flex justify-between">
                <span>Sabtu</span>
                <span className="text-white font-medium">09.00-17.00</span>
              </li>
              <li className="flex justify-between">
                <span>Minggu</span>
                <span className="text-white font-medium">09.00-17.00</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
          <p>&copy; {currentYear} Kaffah Physiotherapy. All rights reserved.</p>
        </div>
      </div>
    </footer>;
};
export default Footer;