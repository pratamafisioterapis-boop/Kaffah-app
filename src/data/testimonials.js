// Real patient testimonials transcribed directly from Kaffah Physiotherapy's
// actual Google Maps listing (screenshots provided by the clinic owner).
// Only reviews with complete, untruncated text were included — several
// visible in the screenshots were cut off by Google's "lainnya" (read more)
// and were deliberately left out rather than guessed/paraphrased.
export const TESTIMONIALS = [
  {
    name: 'Siti Kamilah',
    meta: 'Local Guide · 13 ulasan',
    rating: 5,
    relativeTime: '5 jam lalu',
    text: 'Udah langganan banget disini. Entah buat recovery atau pas lagi pegel pasti kesini. Adminnya fast respon dan para fisioterapis nya ramah dan edukatif sekaliii. Highly Recommended🤙',
    featured: true,
  },
  {
    name: 'han wijayanto',
    meta: '7 ulasan',
    rating: 5,
    relativeTime: '5 jam lalu',
    text: 'Proses reservasi yang mudah, adminnya ramah dan menjelaskan dengan sangat baik. fisioterapinya berpengalaman semua. apapun keluhannya mereka punya solusi dan penanganannya.',
    featured: true,
  },
  {
    name: 'salsaa',
    meta: '5 ulasan',
    rating: 5,
    relativeTime: '5 bulan lalu',
    text: 'recommended tempatnya, terapisnya ramah, komunikatif juga mengenai permasalahan yang diderita oleh pasien. Terus juga ruangannya juga nyaman, bersih dan banyak alat alat memadai yang ada seperti di rumah sakit jadi saat terapi tetap merasa nyaman saat melakukan proses terapi. Pokoknya top banget lah di kaffah fisioterapi ini💗',
    featured: true,
  },
  {
    name: 'Ayu Anggraeni',
    meta: '3 ulasan',
    rating: 5,
    relativeTime: 'setahun lalu',
    text: 'Tempatnya bersih dan nyaman untuk terapi. Saya yg sakit saraf kejepit dileher sudah mulai merasakan perubahannya setelah terapi di sini😊 Pertahankan terus pelayanan prima nya☺',
    featured: true,
  },
  {
    name: 'Kris Tiono',
    meta: '1 ulasan',
    rating: 5,
    relativeTime: '10 bulan lalu',
    text: 'Pelayanan yg di berikan sangat baik dan profesional,, alhamdulillah setelah mengikuti 2 sesi kondisi anak saya membaik secara signifikan,, terima kasih kaffah physiotherapy ,semoga makin sukses ke depannya , untuk anda yg mengalami cedera kaffah physiotherapy solusi nya ,,',
    featured: true,
  },
  {
    name: 'Magenta Shynta',
    meta: '5 ulasan',
    rating: 5,
    relativeTime: '6 hari lalu',
    text: 'Pertama kali kesini, fasilitasnya bagus banget. Staffnya juga ramah2. Pinggang udah agak enakan abis dari sini. Terima kasih kak',
    featured: true,
  },
  {
    name: 'Badii mkhyyrh',
    meta: 'Local Guide · 5 ulasan',
    rating: 5,
    relativeTime: 'sebulan lalu',
    text: 'Masya Allah baru kali ini berobat di Kaffa. Padahal posisi sudah sakit hampir 2 bulanan. Pelayanannya bagus banget kakanya ramah sekali....dan Alhamdulillah sekali di fisioterapi kondisi sudah pulih seperti semula ✨',
    featured: false,
  },
  {
    name: 'Yunie Alvaro',
    meta: '3 ulasan',
    rating: 5,
    relativeTime: 'sebulan lalu',
    text: 'udh kesekian kalinya nyobain recovery dan penguatan otot dsini, puas dg hasilnya sabar bgt kakak2nya.. makasi kak',
    featured: false,
  },
  {
    name: 'Tri Astuti Wulandari',
    meta: '3 ulasan',
    rating: 5,
    relativeTime: 'sebulan lalu',
    text: 'Dari reservasi, pelayanan, sampai purna terapi sangat ramah, alhamdulillah sekali terapi saja sdh membaik',
    featured: false,
  },
  {
    name: 'Pingkan Dwinova Rempas',
    meta: '1 ulasan',
    rating: 5,
    relativeTime: 'sebulan lalu',
    text: 'Pelayanan sangat ramah, pokoknya bagus banget',
    featured: false,
  },
  {
    name: 'Bagus Cahya TS',
    meta: '1 ulasan',
    rating: 5,
    relativeTime: 'seminggu lalu',
    text: 'Cukup bisa membantu mengurangi masalah nyeri',
    featured: false,
  },
  {
    name: 'Ipan Rinaldi',
    meta: '1 ulasan',
    rating: 5,
    relativeTime: 'sebulan lalu',
    text: 'Bagus dan memuaskan untuk penanganan nya dan hasil nya cukup baik.',
    featured: false,
  },
];

export const FEATURED_TESTIMONIALS = TESTIMONIALS.filter((t) => t.featured);

// Confirmed directly by the clinic owner from the top of the Google Business
// listing — not derived/estimated from the sampled reviews above.
export const GOOGLE_RATING_SUMMARY = {
  ratingValue: 5.0,
  reviewCount: 264,
};
