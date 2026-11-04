import React, { useEffect, Suspense } from 'react';
import PageSEO from '@/components/seo/PageSEO';
import { lazyRetry } from '@/lib/lazyRetry';
const Navbar = React.lazy(lazyRetry(() => import('@/components/landing/Navbar'), 'Navbar'));
const HeroSection = React.lazy(lazyRetry(() => import('@/components/landing/HeroSection'), 'HeroSection'));
const AboutSection = React.lazy(lazyRetry(() => import('@/components/landing/AboutSection'), 'AboutSection'));
const ServicesSection = React.lazy(lazyRetry(() => import('@/components/landing/ServicesSection'), 'ServicesSection'));
const AdvantagesSection = React.lazy(lazyRetry(() => import('@/components/landing/AdvantagesSection'), 'AdvantagesSection'));
const TherapistsSection = React.lazy(lazyRetry(() => import('@/components/landing/TherapistsSection'), 'TherapistsSection'));
const TestimonialsSection = React.lazy(lazyRetry(() => import('@/components/landing/TestimonialsSection'), 'TestimonialsSection'));
const LocationSection = React.lazy(lazyRetry(() => import('@/components/landing/LocationSection'), 'LocationSection'));
const PricingTeaser = React.lazy(lazyRetry(() => import('@/components/landing/PricingTeaser'), 'PricingTeaser'));
const CTASection = React.lazy(lazyRetry(() => import('@/components/landing/CTASection'), 'CTASection'));
const Footer = React.lazy(lazyRetry(() => import('@/components/landing/Footer'), 'Footer'));
import ErrorBoundary from '@/components/ErrorBoundary';

// Wrap sections in ErrorBoundary so one failed section doesn't kill the whole page
const SafeSection = ({ children }) => (
  <ErrorBoundary>
    {children}
  </ErrorBoundary>
);

const LandingPage = () => {
  useEffect(() => {
    // Smooth scroll handling for hash links on load
    try {
      if (window.location.hash) {
        const element = document.querySelector(window.location.hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } else {
        window.scrollTo(0, 0);
      }
    } catch (e) {
      console.warn("Scroll handling error:", e);
    }
  }, []);

  return (
    <>
      <PageSEO
        title="Fisioterapi Balikpapan | Kaffah Physiotherapy - Klinik Terpercaya di Batu Ampar"
        description="Klinik fisioterapi di Balikpapan Utara dengan terapis bersertifikat SIPF dan pendekatan evidence-based. Tangani nyeri otot & sendi, cedera olahraga, rehabilitasi pasca operasi, hingga stroke. Booking online sekarang."
        path="/"
      />
<Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-kaffah-blue selection:text-white">
        <SafeSection><Navbar /></SafeSection>
        <main>
          <SafeSection><HeroSection /></SafeSection>
          <SafeSection><AboutSection /></SafeSection>
          <SafeSection><ServicesSection /></SafeSection>
          <SafeSection><AdvantagesSection /></SafeSection>
          <SafeSection><TherapistsSection /></SafeSection>
          <SafeSection><TestimonialsSection /></SafeSection>
          <SafeSection><PricingTeaser /></SafeSection>
          <SafeSection><CTASection /></SafeSection>
          <SafeSection><LocationSection /></SafeSection>
        </main>
        <SafeSection><Footer /></SafeSection>
        </div>
      </Suspense>
    </>
  );
};

export default LandingPage;