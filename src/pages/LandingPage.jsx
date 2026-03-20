import React, { useEffect, Suspense } from 'react';
import { Helmet } from 'react-helmet';
const Navbar = React.lazy(() => import('@/components/landing/Navbar'));
const HeroSection = React.lazy(() => import('@/components/landing/HeroSection'));
const AboutSection = React.lazy(() => import('@/components/landing/AboutSection'));
const ServicesSection = React.lazy(() => import('@/components/landing/ServicesSection'));
const AdvantagesSection = React.lazy(() => import('@/components/landing/AdvantagesSection'));
const TherapistsSection = React.lazy(() => import('@/components/landing/TherapistsSection'));
const LocationSection = React.lazy(() => import('@/components/landing/LocationSection'));
const PricingTeaser = React.lazy(() => import('@/components/landing/PricingTeaser'));
const CTASection = React.lazy(() => import('@/components/landing/CTASection'));
const Footer = React.lazy(() => import('@/components/landing/Footer'));
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
      <Helmet>
        <title>Kaffah Physiotherapy - Solusi Fisioterapi Profesional & Terpercaya</title>
        <meta name="description" content="Klinik fisioterapi profesional dengan pendekatan evidence-based untuk pemulihan cedera, pasca operasi, saraf kejepit, dan stroke. Booking online sekarang." />
      </Helmet>
<Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-kaffah-blue selection:text-white">
        <SafeSection><Navbar /></SafeSection>
        <main>
          <SafeSection><HeroSection /></SafeSection>
          <SafeSection><AboutSection /></SafeSection>
          <SafeSection><ServicesSection /></SafeSection>
          <SafeSection><AdvantagesSection /></SafeSection>
          <SafeSection><TherapistsSection /></SafeSection>
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