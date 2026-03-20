import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogIn, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Force bg on pages other than home
  const showBackground = isScrolled || !isHomePage;

  const navLinks = [
    { name: 'Home', href: '/', isHash: false },
    { name: 'Tentang Kami', href: '/#about', isHash: true },
    { name: 'Layanan', href: '/#services', isHash: true },
    { name: 'Tarif', href: '/pricing', isHash: false },
    { name: 'Terapis', href: '/#therapists', isHash: true },
    { name: 'Kontak', href: '/#footer', isHash: true }
  ];

  const handleNavClick = (e, link) => {
    if (link.isHash) {
      if (isHomePage) {
        e.preventDefault();
        const hash = link.href.substring(1); // remove /
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } 
      // If not home page, default behavior (navigate to /#id) works via Link/a
    } else {
        // Standard route link
        window.scrollTo(0,0);
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${showBackground ? 'bg-kaffah-navy/95 backdrop-blur-md shadow-lg py-3' : 'bg-transparent py-5'}`}>
      <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className={`text-2xl font-bold tracking-tight transition-colors ${showBackground ? 'text-white' : 'text-kaffah-navy'}`} onClick={() => window.scrollTo(0,0)}>
          Kaffah <span className="text-kaffah-blue">Physiotherapy</span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-6">
          {navLinks.map(link => (
            link.isHash && isHomePage ? (
                <a 
                    key={link.name} 
                    href={link.href.substring(1)} // remove leading / for anchor on same page
                    onClick={(e) => handleNavClick(e, link)}
                    className={`font-medium text-sm transition-colors hover:text-kaffah-blue ${showBackground ? 'text-slate-200' : 'text-slate-700'}`}
                >
                    {link.name}
                </a>
            ) : (
                <Link 
                    key={link.name}
                    to={link.href}
                    onClick={(e) => handleNavClick(e, link)}
                    className={`font-medium text-sm transition-colors hover:text-kaffah-blue ${showBackground ? 'text-slate-200' : 'text-slate-700'}`}
                >
                    {link.name}
                </Link>
            )
          ))}
          <a href="https://wa.me/6285245965745" target="_blank" rel="noopener noreferrer">
             <Button variant={showBackground ? "secondary" : "outline"} className={`gap-2 ${!showBackground && 'border-kaffah-navy text-kaffah-navy hover:bg-kaffah-navy hover:text-white'}`}>
              <MessageCircle className="w-4 h-4" /> Konsultasi WA
            </Button>
          </a>
          <Link to="/login">
            <Button variant={showBackground ? "secondary" : "default"} className={`gap-2 ${!showBackground && 'bg-kaffah-navy hover:bg-kaffah-navy/90 text-white'}`}>
              <LogIn className="w-4 h-4" /> Login
            </Button>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-2xl focus:outline-none" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className={showBackground ? 'text-white' : 'text-kaffah-navy'} /> : <Menu className={showBackground ? 'text-white' : 'text-kaffah-navy'} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }} 
            className="md:hidden bg-kaffah-navy overflow-hidden shadow-xl"
          >
            <div className="flex flex-col p-4 space-y-4">
              {navLinks.map(link => (
                link.isHash && isHomePage ? (
                    <a 
                        key={link.name} 
                        href={link.href.substring(1)}
                        onClick={(e) => handleNavClick(e, link)}
                        className="text-white font-medium hover:text-kaffah-blue transition-colors"
                    >
                        {link.name}
                    </a>
                ) : (
                    <Link
                        key={link.name}
                        to={link.href}
                        onClick={(e) => handleNavClick(e, link)}
                        className="text-white font-medium hover:text-kaffah-blue transition-colors"
                    >
                        {link.name}
                    </Link>
                )
              ))}
              <div className="h-px bg-white/10 my-2" />
              <a href="https://wa.me/6285245965745" target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                    <MessageCircle className="w-4 h-4" /> Konsultasi WhatsApp
                </Button>
              </a>
              <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="secondary" className="w-full gap-2">
                  <LogIn className="w-4 h-4" /> Login Staff
                </Button>
              </Link>
              <Link to="/booking" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full bg-kaffah-blue hover:bg-kaffah-blue/90 text-white">
                    Booking Online
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;