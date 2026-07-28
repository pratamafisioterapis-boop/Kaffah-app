// Single source of truth for NAP (Name/Address/Phone) and other business
// facts used across meta tags, JSON-LD schema, and page content. Keeping
// this in one place avoids the WhatsApp-number and social-link mismatches
// that used to exist between LocationSection, Footer, and index.html.
export const BUSINESS = {
  name: 'Kaffah Physiotherapy',
  shortName: 'Kaffah Physio',
  url: 'https://kaffahphysiotherapy.com',
  description:
    'Klinik fisioterapi di Batu Ampar, Balikpapan Utara dengan terapis bersertifikat SIPF dan pendekatan evidence-based untuk nyeri otot & sendi, cedera olahraga, rehabilitasi pasca operasi, dan gangguan neuromuskular.',
  telephone: '+6281233339435',
  whatsappUrl: 'https://wa.me/6281233339435',
  whatsappDisplay: '+62 812-3333-9435',
  email: 'kaffah.physiotherapy@gmail.com',
  address: {
    streetAddress: 'Jl. Telindung, Perumnas Blok 1 RT. 07 No. 71',
    addressLocality: 'Batu Ampar, Balikpapan Utara',
    addressRegion: 'Kalimantan Timur',
    postalCode: '76126',
    addressCountry: 'ID',
  },
  addressDisplay: 'Jl. Telindung, Perumnas Blok 1 RT. 07 No. 71, Batu Ampar, Balikpapan Utara',
  googleMapsUrl: 'https://maps.app.goo.gl/ZDLpkBTMQxoH6PZg9',
  mapsEmbedSrc:
    'https://maps.google.com/maps?q=Jl.+Telindung,+Perumnas+Blok+1+RT.+07+NO.+71,+Batu+Ampar,+Balikpapan+Utara&t=&z=15&ie=UTF8&iwloc=&output=embed',
  instagramUrl: 'https://www.instagram.com/kaffah_physio',
  facebookUrl: 'https://www.facebook.com/61566550108509',
  hoursDisplay: [
    { days: 'Senin - Jumat', hours: '09.00 - 21.00' },
    { days: 'Sabtu - Minggu', hours: '09.00 - 17.00' },
  ],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '21:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday', 'Sunday'],
      opens: '09:00',
      closes: '17:00',
    },
  ],
};
