import React from 'react';
import { Helmet } from 'react-helmet';
import { MapPin, Phone, Loader2 } from 'lucide-react';
import { useClinicTenant } from '@/hooks/useClinicTenant';

// Public landing page rendered when a visitor arrives via a clinic's own
// subdomain (kliniksehat.clinara.id) or verified custom domain
// (kliniksehat.com) instead of the platform's own domains. Kept minimal by
// design - clinics manage their real booking flow via their own WhatsApp
// number for now.
const ClinicTenantSitePage = () => {
  const { clinic, loading, notFound } = useClinicTenant();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !clinic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Domain belum terhubung</h1>
        <p className="text-slate-500 max-w-md">
          Domain ini belum dihubungkan ke klinik manapun, atau proses verifikasinya belum selesai.
        </p>
      </div>
    );
  }

  const waNumber = (clinic.phone || '').replace(/[^0-9]/g, '');
  const waHref = waNumber ? `https://wa.me/${waNumber.replace(/^0/, '62')}` : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{clinic.name}</title>
      </Helmet>

      <header className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-3">
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="h-10 w-10 rounded-lg object-cover" />
          ) : null}
          <span className="font-bold text-lg text-slate-800">{clinic.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{clinic.name}</h1>
        <p className="text-slate-500 max-w-xl mx-auto mb-10">
          Layanan fisioterapi profesional. Hubungi kami untuk membuat janji temu.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <Phone className="w-4 h-4" /> Chat WhatsApp
            </a>
          )}
        </div>

        {(clinic.address || clinic.phone) && (
          <div className="bg-white border border-slate-100 rounded-2xl p-6 max-w-md mx-auto text-left space-y-3">
            {clinic.address && (
              <div className="flex items-start gap-3 text-slate-600">
                <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                <span>{clinic.address}</span>
              </div>
            )}
            {clinic.phone && (
              <div className="flex items-start gap-3 text-slate-600">
                <Phone className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                <span>{clinic.phone}</span>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-8">
        Powered by Clinara
      </footer>
    </div>
  );
};

export default ClinicTenantSitePage;
