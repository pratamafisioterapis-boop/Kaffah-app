import React from 'react';
import { Helmet } from 'react-helmet';
import { BUSINESS } from '@/lib/businessInfo';

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'MedicalBusiness',
  '@id': `${BUSINESS.url}/#business`,
  name: BUSINESS.name,
  description: BUSINESS.description,
  url: BUSINESS.url,
  telephone: BUSINESS.telephone,
  email: BUSINESS.email,
  image: `${BUSINESS.url}/logo512.png`,
  priceRange: 'Rp',
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.address.streetAddress,
    addressLocality: BUSINESS.address.addressLocality,
    addressRegion: BUSINESS.address.addressRegion,
    postalCode: BUSINESS.address.postalCode,
    addressCountry: BUSINESS.address.addressCountry,
  },
  openingHoursSpecification: BUSINESS.openingHoursSpecification,
  sameAs: [BUSINESS.instagramUrl, BUSINESS.facebookUrl],
};

/**
 * Shared per-page SEO: title/description/canonical via react-helmet, plus the
 * site-wide MedicalBusiness JSON-LD identity and any page-specific JSON-LD
 * (e.g. FAQPage, Service) passed through `schema`.
 */
const PageSEO = ({ title, description, path = '/', schema = [] }) => {
  const canonicalUrl = `${BUSINESS.url}${path}`;
  const extraSchema = Array.isArray(schema) ? schema : [schema];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={BUSINESS.name} />
      <meta property="og:image" content={`${BUSINESS.url}/logo512.png`} />
      <meta property="og:locale" content="id_ID" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
      {extraSchema.map((item, idx) => (
        <script key={idx} type="application/ld+json">{JSON.stringify(item)}</script>
      ))}
    </Helmet>
  );
};

export default PageSEO;
