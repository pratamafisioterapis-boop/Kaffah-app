import React from 'react';
import { Helmet } from 'react-helmet';
import { BUSINESS } from '@/lib/businessInfo';
import { TESTIMONIALS, GOOGLE_RATING_SUMMARY } from '@/data/testimonials';

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
  // Real Google reviews (transcribed from the clinic's actual listing) and
  // the true rating summary confirmed by the owner — not derived/estimated.
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: GOOGLE_RATING_SUMMARY.ratingValue,
    reviewCount: GOOGLE_RATING_SUMMARY.reviewCount,
  },
  review: TESTIMONIALS.map((t) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: t.name },
    reviewRating: { '@type': 'Rating', ratingValue: t.rating, bestRating: 5 },
    reviewBody: t.text,
  })),
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
