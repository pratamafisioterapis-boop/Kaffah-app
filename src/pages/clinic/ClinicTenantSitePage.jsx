import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import { useClinicTenant } from '@/hooks/useClinicTenant';
import { supabase } from '@/lib/customSupabaseClient';
import { getLandingTemplate, mergeLandingContent } from '@/config/landingTemplates';
import ClinicLandingRenderer from '@/components/clinic-landing/ClinicLandingRenderer';
import PremiumClinicLanding from '@/components/clinic-landing/PremiumClinicLanding';

// Public landing page rendered when a visitor arrives via a clinic's own
// subdomain (kliniksehat.clinara.id) or verified custom domain
// (kliniksehat.com) instead of the platform's own domains. Layout, theme
// colors, and section copy all come from the clinic's own choice of
// landing_template + landing_content/landing_primary_color/landing_accent_color
// (set from the "Landing Page" tab in owner Settings) -- unrelated to and
// never used by kaffahphysio.id, which keeps its own static landing page.
const ClinicTenantSitePage = () => {
  const { clinic, loading, notFound } = useClinicTenant();
  const [pricelist, setPricelist] = useState([]);

  useEffect(() => {
    if (!clinic?.id) return;
    supabase
      .rpc('get_clinic_pricelist', { p_clinic_id: clinic.id })
      .then(({ data }) => setPricelist(data || []));
  }, [clinic?.id]);

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

  const template = getLandingTemplate(clinic.landing_template);
  const content = mergeLandingContent(template.defaultContent, clinic.landing_content);
  const Renderer = template.style.premiumLayout ? PremiumClinicLanding : ClinicLandingRenderer;

  return (
    <>
      <Helmet>
        <title>{clinic.name}</title>
      </Helmet>
      <Renderer
        clinic={clinic}
        style={template.style}
        content={content}
        pricelist={pricelist}
        bookingHref="/booking"
        waHref={waHref}
        primaryColor={clinic.landing_primary_color}
        accentColor={clinic.landing_accent_color}
        defaultColors={template.colors}
      />
    </>
  );
};

export default ClinicTenantSitePage;
