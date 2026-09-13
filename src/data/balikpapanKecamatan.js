// Referensi kecamatan & kelurahan Kota Balikpapan — 6 kecamatan, 34
// kelurahan total. Dipakai sebagai starting point di Setup Dapil (modul
// Suara PKS) supaya menambah dapil baru tidak perlu ketik nama kelurahan
// satu-satu. Nama-nama ini murni bantuan awal, bisa diedit/dihapus admin
// kapan saja setelah ditambahkan.
//
// Sumber: Wikipedia "Daftar kecamatan dan kelurahan di Kota Balikpapan" dan
// situs web resmi tiap kecamatan (web.balikpapan.go.id), dicek silang lewat
// pencarian per-kecamatan — totalnya pas 34 kelurahan, sesuai angka resmi.
export const BALIKPAPAN_KECAMATAN_DEFAULTS = [
  {
    nama: 'Balikpapan Utara',
    kelurahan: ['Batu Ampar', 'Gunung Samarinda', 'Gunung Samarinda Baru', 'Graha Indah', 'Karang Joang', 'Muara Rapak'],
  },
  {
    nama: 'Balikpapan Selatan',
    kelurahan: ['Sepinggan', 'Sepinggan Baru', 'Sepinggan Raya', 'Sungai Nangka', 'Gunung Bahagia', 'Damai Baru', 'Damai Bahagia'],
  },
  {
    nama: 'Balikpapan Timur',
    kelurahan: ['Manggar', 'Manggar Baru', 'Lamaru', 'Teritip'],
  },
  {
    nama: 'Balikpapan Barat',
    kelurahan: ['Baru Ilir', 'Baru Tengah', 'Baru Ulu', 'Kariangau', 'Marga Sari', 'Margo Mulyo'],
  },
  {
    nama: 'Balikpapan Tengah',
    kelurahan: ['Gunung Sari Ulu', 'Gunung Sari Ilir', 'Karang Rejo', 'Karang Jati', 'Mekar Sari', 'Sumber Rejo'],
  },
  {
    nama: 'Balikpapan Kota',
    kelurahan: ['Prapatan', 'Telaga Sari', 'Klandasan Ulu', 'Klandasan Ilir', 'Damai'],
  },
];
