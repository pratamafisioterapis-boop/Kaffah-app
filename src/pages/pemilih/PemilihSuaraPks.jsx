import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllRows } from '@/lib/supabasePaginate';
import { useToast } from '@/components/ui/use-toast';
import PemilihSelect from './PemilihSelect';
import {
  Loader2, FileUp, Search, X, Trophy, Vote, MapPin, Users, BarChart3,
  PieChart as PieChartIcon, Save, CheckCircle2, LayoutGrid, UploadCloud, RefreshCw, ListFilter, Table2,
  Pencil, Plus, Presentation, ChevronLeft, ChevronRight, Play, Pause,
  GitCompare, TrendingUp, TrendingDown, Minus, Settings2,
} from 'lucide-react';
import PemilihSuaraPksSetup from './PemilihSuaraPksSetup';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Tiap halaman sekarang dipecah jadi 2 potongan (atas+bawah) yang diproses
// BERSAMAAN (lihat splitCanvasForOcr), jadi CONCURRENCY di sini = jumlah
// HALAMAN yang diproses sekaligus, bukan jumlah permintaan OCR — total
// permintaan OCR yang berjalan bersamaan tetap CONCURRENCY x 2.
const CONCURRENCY = 1;
// Harus lebih besar dari ANTHROPIC_TIMEOUT_MS di edge function (140 detik)
// plus margin jaringan, supaya halaman yang sebenarnya berhasil (hanya lambat)
// tidak keburu dianggap gagal oleh sisi frontend duluan.
const INVOKE_TIMEOUT_MS = 165000;
// Skala dihitung dari ukuran halaman asli (bukan angka tetap) supaya sisi
// terpanjang selalu ~1500px — PDF hasil scan/olahan tool lain kadang punya
// MediaBox jauh lebih besar dari A4; skala tetap bisa menghasilkan gambar
// raksasa yang bikin OCR lambat/gagal (timeout ~40an detik, lalu 502 dari
// Anthropic karena payload terlalu besar).
const TARGET_MAX_DIMENSION = 1500;
const PARTY_MATCH = /keadilan\s*sejahtera|\bpks\b/i;
// Halaman ini cuma butuh baris PKS, jadi server OCR diberi tahu supaya tidak
// menyalin ~18 partai lain sekalian. Selain jauh lebih cepat, ini yang bikin
// hasilnya tidak lagi kepotong di tengah (jawaban model terlalu panjang dulunya
// bikin semua halaman gagal parsing).
const PARTY_FILTER = 'Partai Keadilan Sejahtera';

const RANK_COLORS = ['#dc2626', '#d97706', '#2563eb', '#7c3aed', '#ea580c'];
const TPS_TABLE_BORDER = '#9aa1ab';
// Warna pastel per kolom caleg di Tabel Rincian per TPS — tiap caleg dapat satu warna
// tetap (bukan warna selang-seling per baris/zebra) supaya kolomnya mudah dibedakan.
const PASTEL_COLUMN_COLORS = [
  '#FFE3E3', '#FFE8CC', '#FFF9DB', '#E9FAC8', '#D3F9D8', '#C5F6FA',
  '#D0EBFF', '#DBE4FF', '#E5DBFF', '#F3D9FA', '#FFDEEB', '#F1F3F5',
];
const PIE_COLORS = ['#dc2626', '#ef4444', '#f59e0b', '#2563eb', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#65a30d', '#9333ea', '#0d9488', '#94a3b8'];

const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Rincian per TPS gampang melewati batas 1000 baris PostgREST (jumlah TPS x
// jumlah caleg) — pakai fetchAllRows (src/lib/supabasePaginate.js) untuk
// semua query di sini yang bisa melewati itu.
const fetchAllTpsRows = fetchAllRows;

// Dua tahun pemilu yang dibandingkan di slide analisa — PKS baru punya data
// Pileg 2019 & 2024, jadi tetap (bukan otomatis dari data yang ada) supaya
// slide perbandingan tidak muncul untuk kombinasi tahun yang tidak relevan.
const COMPARE_YEARS = [2019, 2024];

const computeDelta = (oldVal, newVal) => {
  const diff = (newVal || 0) - (oldVal || 0);
  const pct = oldVal ? (diff / oldVal) * 100 : (newVal ? 100 : 0);
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  return { diff, pct, direction };
};

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
]);

// supabase-js hanya kasih pesan generik ("Edge Function returned a non-2xx
// status code") untuk FunctionsHttpError — pesan asli dari edge function
// (mis. error dari Anthropic API) ada di body response, harus dibaca manual.
const describeFunctionError = async (error) => {
  try {
    if (error?.context?.json) {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (_e) { /* body bukan JSON atau sudah kebaca, pakai pesan default */ }
  return error?.message || 'Gagal memanggil server OCR';
};

// Satu panggilan OCR untuk satu potongan gambar (bisa halaman penuh atau
// potongan atas/bawah hasil splitCanvasForOcr). `isPartial` memberi tahu
// server bahwa gambar ini mungkin tidak memuat judul tabel/baris header
// (karena sudah kepotong), supaya model tidak salah menyimpulkan "bukan tabel
// suara" hanya karena tidak melihat judulnya.
const callOcrHalf = async (imageBase64, partyFilter, isPartial, invokeTimeoutMs) => {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('pemilih-ocr-suara-pdf', {
      body: { image_base64: imageBase64, media_type: 'image/jpeg', party_filter: partyFilter || undefined, is_partial: isPartial },
    }),
    invokeTimeoutMs,
    `Waktu tunggu server OCR habis (${invokeTimeoutMs / 1000}s)`
  );
  if (error) throw new Error(await describeFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data?.data || { is_vote_table: false, rows: [], column_headers: [] };
};

const renderPageCanvas = async (pdf, pageNumber, rotate) => {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(baseViewport.width, baseViewport.height);
  const scale = Math.min(3, Math.max(0.5, TARGET_MAX_DIMENSION / longestSide));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  if (!rotate) return canvas;

  const rotated = document.createElement('canvas');
  rotated.width = canvas.height;
  rotated.height = canvas.width;
  const rctx = rotated.getContext('2d');
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate(-Math.PI / 2);
  rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rotated;
};

const canvasToBase64 = (canvas) => canvas.toDataURL('image/jpeg', 0.88).split(',')[1];

// Tabel rekap yang panjang (banyak partai/calon) butuh model membaca/menyisir
// puluhan baris untuk menemukan baris yang relevan, dan itu yang bikin satu
// permintaan OCR bisa lewat dari 2 menit untuk halaman padat (lihat log
// produksi). Solusinya: potong tiap halaman jadi 2 gambar (atas & bawah,
// overlap 20% di tengah supaya baris yang persis di batas tidak terlewat),
// proses paralel, lalu gabung hasilnya — tiap permintaan jadi jauh lebih
// ringan (~60% dari total baris) sehingga lebih cepat & jarang timeout.
const SPLIT_FRACTION = 0.6;

const splitCanvasForOcr = (canvas) => {
  const w = canvas.width;
  const h = canvas.height;
  const topHeight = Math.round(h * SPLIT_FRACTION);
  const bottomStart = h - topHeight;
  const bottomHeight = h - bottomStart;

  const topCanvas = document.createElement('canvas');
  topCanvas.width = w;
  topCanvas.height = topHeight;
  topCanvas.getContext('2d').drawImage(canvas, 0, 0, w, topHeight, 0, 0, w, topHeight);

  const bottomCanvas = document.createElement('canvas');
  bottomCanvas.width = w;
  bottomCanvas.height = bottomHeight;
  bottomCanvas.getContext('2d').drawImage(canvas, 0, bottomStart, w, bottomHeight, 0, 0, w, bottomHeight);

  return [topCanvas, bottomCanvas];
};

// Kunci unik per baris untuk menggabungkan hasil potongan atas & bawah tanpa
// duplikat (baris yang jatuh di zona overlap bisa muncul di kedua potongan).
const rowMergeKey = (row) => (row.is_party_row && !row.candidate_name
  ? `party::${normalize(row.party_name)}`
  : `cand::${normalize(row.candidate_name)}::${normalize(row.party_name)}`);

// Baris yang sama dari kedua potongan dipilih versi dengan sel terisi paling
// lengkap (paling sedikit null), karena posisinya di tepi potongan kadang
// bikin satu sisi terbaca lebih jelas dari sisi lainnya.
const rowCompleteness = (row) => (row.values || []).filter((v) => v !== null && v !== undefined).length;

const mergePageHalves = (top, bottom) => {
  const parts = [top, bottom].filter(Boolean);
  const isVoteTable = parts.some((p) => p.is_vote_table);
  if (!isVoteTable) return { is_vote_table: false, rows: [], column_headers: [], sheet_info: null };

  // Header kolom TPS biasanya cuma tercetak sekali di bagian atas tabel, jadi
  // ambil dari potongan mana pun yang berhasil membacanya (biasanya potongan atas).
  const column_headers = parts.find((p) => (p.column_headers || []).length > 0)?.column_headers || [];

  const sheet_info = parts.reduce((acc, p) => {
    if (!p.sheet_info) return acc;
    const merged = { ...acc };
    Object.keys(p.sheet_info).forEach((k) => {
      if ((merged[k] === undefined || merged[k] === null) && p.sheet_info[k] != null) merged[k] = p.sheet_info[k];
    });
    return merged;
  }, {});

  const rowMap = new Map();
  parts.forEach((p) => {
    (p.rows || []).forEach((row) => {
      const key = rowMergeKey(row);
      const existing = rowMap.get(key);
      if (!existing || rowCompleteness(row) > rowCompleteness(existing)) rowMap.set(key, row);
    });
  });

  return { is_vote_table: true, rows: Array.from(rowMap.values()), column_headers, sheet_info: Object.keys(sheet_info).length ? sheet_info : null };
};

const StatPill = ({ icon: Icon, label, value, color, bg }) => (
  <div className="p-card p-card-hover" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} strokeWidth={2.3} />
      </div>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#1a1d29', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  </div>
);

const CardHeader = ({ title, subtitle, icon: Icon, iconColor, iconBg }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
    {Icon && (
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Icon size={15} color={iconColor} />
      </div>
    )}
    <div>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29', letterSpacing: '-0.01em' }}>{title}</h3>
      {subtitle && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#9ca3af' }}>{subtitle}</p>}
    </div>
  </div>
);

const PemilihSuaraPks = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState('dashboard');
  const [manualTabOpened, setManualTabOpened] = useState(false);
  useEffect(() => { if (tab === 'manual') setManualTabOpened(true); }, [tab]);
  const [slideshowOpen, setSlideshowOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [dapilList, setDapilList] = useState([]);
  const [calegMasterRows, setCalegMasterRows] = useState([]);
  const [selectedDapil, setSelectedDapil] = useState(() => {
    try { return localStorage.getItem('pemilih_suara_pks_dapil') || ''; } catch { return ''; }
  });
  const [filterKelurahan, setFilterKelurahan] = useState('');
  const [selectedYear, setSelectedYear] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    // pemilih_suara_caleg tumbuh langsung dengan jumlah dapil (dapil x
    // kelurahan x caleg), jadi wajib di-paginate — sudah ratusan baris untuk
    // satu dapil saja, gampang lewat 1000 begitu dapil lain ditambahkan.
    const [{ data: suara }, { data: kel }, { data: kec }, { data: caleg }] = await Promise.all([
      fetchAllRows(() => supabase.from('pemilih_suara_caleg').select('id, kelurahan_id, candidate_number, candidate_name, total_suara, sheet_info, updated_at, election_year').order('candidate_number')),
      supabase.from('pemilih_kelurahan').select('id, nama, kecamatan_id').order('nama'),
      supabase.from('pemilih_kecamatan').select('id, nama').order('nama'),
      fetchAllRows(() => supabase.from('pemilih_caleg_master').select('id, kecamatan_id, election_year, candidate_number, candidate_name').order('candidate_number')),
    ]);
    setRows(suara || []);
    setKelurahanList(kel || []);
    setDapilList(kec || []);
    setCalegMasterRows(caleg || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Dapil aktif: pakai yang tersimpan di localStorage kalau masih ada di
  // daftar, kalau tidak jatuh ke dapil pertama — supaya pilihan terakhir
  // diingat lintas kunjungan tanpa perlu login/preferensi server.
  useEffect(() => {
    if (dapilList.length === 0) return;
    if (dapilList.some((d) => d.id === selectedDapil)) return;
    setSelectedDapil(dapilList[0].id);
  }, [dapilList, selectedDapil]);

  useEffect(() => {
    try {
      if (selectedDapil) localStorage.setItem('pemilih_suara_pks_dapil', selectedDapil);
    } catch { /* localStorage tidak tersedia, abaikan */ }
    // Filter kelurahan di dashboard mengacu ke ID kelurahan — kalau dapil
    // pindah, ID lama itu milik dapil lain dan harus direset supaya tidak
    // diam-diam membuat filteredRows kosong.
    setFilterKelurahan('');
  }, [selectedDapil]);

  const dapilKelurahanIds = useMemo(
    () => new Set(kelurahanList.filter((k) => k.kecamatan_id === selectedDapil).map((k) => k.id)),
    [kelurahanList, selectedDapil]
  );

  // Semua tab lain (dashboard, TPS, upload, manual) hanya boleh melihat
  // kelurahan & data suara milik dapil yang sedang aktif.
  const scopedKelurahanList = useMemo(
    () => kelurahanList.filter((k) => dapilKelurahanIds.has(k.id)),
    [kelurahanList, dapilKelurahanIds]
  );

  const dapilRows = useMemo(
    () => rows.filter((r) => dapilKelurahanIds.has(r.kelurahan_id)),
    [rows, dapilKelurahanIds]
  );

  const availableYears = useMemo(() => {
    const years = new Set(dapilRows.map((r) => r.election_year));
    return Array.from(years).sort((a, b) => b - a);
  }, [dapilRows]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) setSelectedYear(availableYears[0]);
    else if (availableYears.length === 0 && selectedYear !== null) setSelectedYear(null);
  }, [availableYears, selectedYear]);

  const kelurahanMap = useMemo(() => {
    const map = {};
    kelurahanList.forEach((k) => { map[k.id] = k.nama; });
    return map;
  }, [kelurahanList]);

  const yearRows = useMemo(
    () => dapilRows.filter((r) => r.election_year === selectedYear),
    [dapilRows, selectedYear]
  );

  const filteredRows = useMemo(
    () => (filterKelurahan ? yearRows.filter((r) => r.kelurahan_id === filterKelurahan) : yearRows),
    [yearRows, filterKelurahan]
  );

  const kelurahanTercakup = useMemo(() => new Set(yearRows.map((r) => r.kelurahan_id)), [yearRows]);

  const totalSuaraPartai = useMemo(
    () => filteredRows.reduce((sum, r) => sum + (r.total_suara || 0), 0),
    [filteredRows]
  );

  const totalSuaraTanpaCalon = useMemo(
    () => filteredRows.filter((r) => r.candidate_number === 0).reduce((sum, r) => sum + (r.total_suara || 0), 0),
    [filteredRows]
  );

  const perCaleg = useMemo(() => {
    const agg = {};
    filteredRows.forEach((r) => {
      const key = r.candidate_number;
      if (!agg[key]) {
        agg[key] = {
          candidate_number: r.candidate_number,
          candidate_name: r.candidate_name || 'Suara Partai (tanpa calon)',
          isPartyRow: r.candidate_number === 0,
          total: 0,
          perKelurahan: [],
        };
      }
      agg[key].total += r.total_suara || 0;
      agg[key].perKelurahan.push({ kelurahan: kelurahanMap[r.kelurahan_id] || '-', total: r.total_suara || 0 });
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [filteredRows, kelurahanMap]);

  const calegOnly = useMemo(() => perCaleg.filter((c) => !c.isPartyRow), [perCaleg]);

  const chartData = useMemo(
    () => calegOnly.map((c) => ({
      name: c.candidate_name.length > 22 ? c.candidate_name.slice(0, 20) + '…' : c.candidate_name,
      fullName: c.candidate_name,
      total: c.total,
    })),
    [calegOnly]
  );

  const pieData = useMemo(() => {
    const top = calegOnly.slice(0, 8).map((c) => ({ name: c.candidate_name, value: c.total }));
    const restTotal = calegOnly.slice(8).reduce((s, c) => s + c.total, 0);
    if (restTotal > 0) top.push({ name: 'Lainnya', value: restTotal });
    if (totalSuaraTanpaCalon > 0) top.push({ name: 'Suara Partai (tanpa calon)', value: totalSuaraTanpaCalon });
    return top;
  }, [calegOnly, totalSuaraTanpaCalon]);

  const perKelurahanTotal = useMemo(() => {
    const agg = {};
    yearRows.forEach((r) => {
      const nama = kelurahanMap[r.kelurahan_id] || 'Belum Diketahui';
      agg[nama] = (agg[nama] || 0) + (r.total_suara || 0);
    });
    return Object.entries(agg).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total);
  }, [yearRows, kelurahanMap]);

  // Daftar caleg induk (nomor + nama) untuk dapil & tahun terpilih, dipakai
  // sebagai acuan kolom di tab Detail per TPS supaya urutannya konsisten
  // antar kelurahan. Diseed dari roster yang diatur di tab Setup (supaya
  // nama caleg sudah muncul walau belum ada suara masuk sama sekali), lalu
  // dilengkapi dari data suara yang sudah ada (kalau ada caleg yang muncul
  // di data tapi belum didaftarkan di roster). Nomor & nama caleg bisa
  // berbeda antar tahun pemilu, jadi harus per dapil + per tahun.
  const dapilCalegMaster = useMemo(
    () => calegMasterRows
      .filter((c) => c.kecamatan_id === selectedDapil && c.election_year === selectedYear)
      .sort((a, b) => a.candidate_number - b.candidate_number),
    [calegMasterRows, selectedDapil, selectedYear]
  );

  const candidateMasterList = useMemo(() => {
    const map = new Map();
    dapilCalegMaster.forEach((c) => {
      map.set(c.candidate_number, { number: c.candidate_number, name: c.candidate_name });
    });
    yearRows.forEach((r) => {
      if (!map.has(r.candidate_number)) {
        map.set(r.candidate_number, { number: r.candidate_number, name: r.candidate_name || 'Suara Partai' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [dapilCalegMaster, yearRows]);

  // Data perbandingan 2019 vs 2024 untuk slide analisa di Mode Slideshow —
  // dihitung dari seluruh `dapilRows` (bukan yearRows) karena harus mencakup
  // kedua tahun sekaligus, tapi tetap ikut filter kelurahan yang aktif di
  // dashboard dan tetap dibatasi ke dapil yang sedang aktif.
  const compareRowsByYear = useMemo(() => {
    const out = {};
    COMPARE_YEARS.forEach((y) => {
      out[y] = dapilRows.filter((r) => r.election_year === y && (!filterKelurahan || r.kelurahan_id === filterKelurahan));
    });
    return out;
  }, [dapilRows, filterKelurahan]);

  const compareAvailable = COMPARE_YEARS.every((y) => compareRowsByYear[y].length > 0);

  const compareTotals = useMemo(() => {
    const out = {};
    COMPARE_YEARS.forEach((y) => {
      const rs = compareRowsByYear[y];
      out[y] = {
        totalSuara: rs.reduce((s, r) => s + (r.total_suara || 0), 0),
        totalPartai: rs.filter((r) => r.candidate_number === 0).reduce((s, r) => s + (r.total_suara || 0), 0),
        calegCount: new Set(rs.filter((r) => r.candidate_number !== 0).map((r) => r.candidate_number)).size,
        kelurahanCount: new Set(rs.map((r) => r.kelurahan_id)).size,
      };
    });
    return out;
  }, [compareRowsByYear]);

  const compareByKelurahan = useMemo(() => {
    const map = new Map();
    COMPARE_YEARS.forEach((y) => {
      compareRowsByYear[y].forEach((r) => {
        const id = r.kelurahan_id;
        if (!map.has(id)) map.set(id, { id, nama: kelurahanMap[id] || 'Belum Diketahui', values: {} });
        const entry = map.get(id);
        entry.values[y] = (entry.values[y] || 0) + (r.total_suara || 0);
      });
    });
    return Array.from(map.values()).sort((a, b) => (b.values[COMPARE_YEARS[1]] || 0) - (a.values[COMPARE_YEARS[1]] || 0));
  }, [compareRowsByYear, kelurahanMap]);

  // Hanya caleg yang muncul di kedua tahun (petahana / maju lagi) yang bisa
  // dibandingkan apel-ke-apel; dicocokkan dari nama yang dinormalisasi karena
  // nomor urut caleg bisa berubah antar pemilu.
  const compareByCaleg = useMemo(() => {
    const map = new Map();
    COMPARE_YEARS.forEach((y) => {
      compareRowsByYear[y].forEach((r) => {
        if (r.candidate_number === 0 || !r.candidate_name) return;
        const key = normalize(r.candidate_name);
        if (!map.has(key)) map.set(key, { key, name: r.candidate_name, values: {} });
        const entry = map.get(key);
        entry.values[y] = (entry.values[y] || 0) + (r.total_suara || 0);
      });
    });
    return Array.from(map.values())
      .filter((c) => COMPARE_YEARS.every((y) => c.values[y] !== undefined))
      .sort((a, b) => (b.values[COMPARE_YEARS[1]] || 0) - (a.values[COMPARE_YEARS[1]] || 0));
  }, [compareRowsByYear]);

  const activeDapilName = dapilList.find((d) => d.id === selectedDapil)?.nama || '';

  return (
    <div>
      <div style={{
        borderRadius: 20, padding: '26px 30px', marginBottom: 24,
        background: 'linear-gradient(135deg, #17181f 0%, #2b1a0f 60%, #431f08 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.28), transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Vote size={16} color="#fdba74" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fdba74', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Perolehan Suara Pileg
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Partai Keadilan Sejahtera{activeDapilName ? ` — ${activeDapilName}` : ''}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#d4d4d8' }}>
            Rekap suara caleg PKS per kelurahan, berdasarkan Formulir Model DAA1-DPRD yang diupload.
          </p>
        </div>
      </div>

      {dapilList.length > 0 && (
        <div style={{ marginBottom: 18, maxWidth: 320 }}>
          <label className="p-label">Dapil / Kecamatan Aktif</label>
          <PemilihSelect
            value={selectedDapil}
            onChange={setSelectedDapil}
            options={dapilList.map((d) => ({ value: d.id, label: d.nama }))}
            title="Pilih Dapil / Kecamatan"
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap', borderBottom: '1.5px solid var(--p-border)', paddingBottom: 12 }}>
        {[
          { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
          { key: 'tps', label: 'Detail per TPS', icon: Table2 },
          { key: 'manual', label: 'Input Manual per TPS', icon: Pencil },
          { key: 'upload', label: 'Upload PDF per Kelurahan', icon: UploadCloud },
          { key: 'setup', label: 'Setup Dapil & Caleg', icon: Settings2 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 11, border: '1.5px solid ' + (active ? '#ea580c' : 'var(--p-border)'),
                background: active ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#fff',
                color: active ? '#fff' : '#4b5563',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.16s',
              }}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab !== 'setup' && availableYears.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Tahun Pemilu:</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  style={{
                    padding: '7px 16px', borderRadius: 999, border: '1.5px solid ' + (selectedYear === y ? '#ea580c' : 'var(--p-border)'),
                    background: selectedYear === y ? '#fff7ed' : '#fff',
                    color: selectedYear === y ? '#ea580c' : '#6b7280',
                    fontWeight: 800, fontSize: 13, cursor: 'pointer', transition: 'all 0.16s',
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          {tab === 'dashboard' && yearRows.length > 0 && (
            <button
              className="p-btn-primary"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
              onClick={() => setSlideshowOpen(true)}
            >
              <Presentation size={15} /> Mode Slideshow
            </button>
          )}
        </div>
      )}

      {tab === 'dashboard' ? (
        loading ? (
          <div style={{ padding: 80, textAlign: 'center' }}><Loader2 className="animate-spin" size={30} color="#ea580c" /></div>
        ) : scopedKelurahanList.length === 0 ? (
          <div className="p-card" style={{ padding: 50, textAlign: 'center' }}>
            <MapPin size={32} color="#d4d4d8" style={{ marginBottom: 10 }} />
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
              Dapil ini belum punya kelurahan/desa. Buka tab "Setup Dapil & Caleg" untuk menambahkannya.
            </p>
          </div>
        ) : yearRows.length === 0 ? (
          <div className="p-card" style={{ padding: 50, textAlign: 'center' }}>
            <Vote size={32} color="#d4d4d8" style={{ marginBottom: 10 }} />
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Belum ada data suara PKS untuk dapil ini. Upload PDF Model DAA1-DPRD per kelurahan di tab "Upload PDF per Kelurahan".</p>
          </div>
        ) : (
          <PksDashboard
            kelurahanList={scopedKelurahanList}
            filterKelurahan={filterKelurahan}
            setFilterKelurahan={setFilterKelurahan}
            kelurahanTercakup={kelurahanTercakup}
            totalSuaraPartai={totalSuaraPartai}
            totalSuaraTanpaCalon={totalSuaraTanpaCalon}
            perCaleg={perCaleg}
            calegOnly={calegOnly}
            chartData={chartData}
            pieData={pieData}
            perKelurahanTotal={perKelurahanTotal}
          />
        )
      ) : tab === 'tps' ? (
        <PksTpsDetail
          kelurahanList={scopedKelurahanList}
          kelurahanTercakup={kelurahanTercakup}
          candidateMasterList={candidateMasterList}
          selectedYear={selectedYear}
          toast={toast}
        />
      ) : tab === 'upload' ? (
        <PksUpload kelurahanList={scopedKelurahanList} onSaved={fetchAll} toast={toast} defaultYear={selectedYear || 2024} />
      ) : tab === 'setup' ? (
        <PemilihSuaraPksSetup
          dapilList={dapilList}
          selectedDapil={selectedDapil}
          onSelectDapil={setSelectedDapil}
          kelurahanList={scopedKelurahanList}
          calegMasterRows={calegMasterRows.filter((c) => c.kecamatan_id === selectedDapil)}
          defaultYear={selectedYear || availableYears[0] || new Date().getFullYear()}
          toast={toast}
          onChanged={fetchAll}
        />
      ) : null}

      {manualTabOpened && (
        <div style={{ display: tab === 'manual' ? 'block' : 'none' }}>
          <PksManualInput
            kelurahanList={scopedKelurahanList}
            candidateMasterList={candidateMasterList}
            onSaved={fetchAll}
            toast={toast}
            defaultYear={selectedYear || 2024}
          />
        </div>
      )}

      {slideshowOpen && (
        <PksSlideshow
          onClose={() => setSlideshowOpen(false)}
          selectedYear={selectedYear}
          dapilName={activeDapilName}
          filterKelurahanName={kelurahanMap[filterKelurahan] || null}
          kelurahanTercakupCount={kelurahanTercakup.size}
          kelurahanTotalCount={scopedKelurahanList.length}
          totalSuaraPartai={totalSuaraPartai}
          totalSuaraTanpaCalon={totalSuaraTanpaCalon}
          perCaleg={perCaleg}
          calegOnly={calegOnly}
          chartData={chartData}
          pieData={pieData}
          perKelurahanTotal={perKelurahanTotal}
          compareAvailable={compareAvailable}
          compareYears={COMPARE_YEARS}
          compareTotals={compareTotals}
          compareByKelurahan={compareByKelurahan}
          compareByCaleg={compareByCaleg}
        />
      )}
    </div>
  );
};

const PksDashboard = ({
  kelurahanList, filterKelurahan, setFilterKelurahan, kelurahanTercakup,
  totalSuaraPartai, totalSuaraTanpaCalon, perCaleg, calegOnly, chartData, pieData, perKelurahanTotal,
}) => {
  const maxCaleg = calegOnly[0]?.total || 1;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, flex: 1 }}>
          <StatPill icon={Vote} label="Total Suara PKS" value={totalSuaraPartai.toLocaleString('id-ID')} color="#ea580c" bg="#fff7ed" />
          <StatPill icon={Trophy} label="Suara Partai (tanpa calon)" value={totalSuaraTanpaCalon.toLocaleString('id-ID')} color="#d97706" bg="#fffbeb" />
          <StatPill icon={Users} label="Caleg Terdaftar" value={calegOnly.length} color="#2563eb" bg="#eff6ff" />
          <StatPill icon={MapPin} label="Kelurahan Tercakup" value={`${kelurahanTercakup.size} / ${kelurahanList.length}`} color="#dc2626" bg="#fef2f2" />
        </div>
      </div>

      <div style={{ marginBottom: 20, maxWidth: 280 }}>
        <label className="p-label">Filter Kelurahan</label>
        <PemilihSelect
          value={filterKelurahan}
          onChange={setFilterKelurahan}
          options={kelurahanList.filter((k) => kelurahanTercakup.has(k.id)).map((k) => ({ value: k.id, label: k.nama }))}
          allLabel="Semua Kelurahan"
          title="Pilih Kelurahan"
        />
      </div>

      <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="p-card" style={{ padding: 24 }}>
          <CardHeader title="Perolehan Suara per Caleg" subtitle="Total suara sah tiap caleg PKS, diurutkan dari terbanyak" icon={BarChart3} iconColor="#ea580c" iconBg="#fff7ed" />
          <div style={{ height: Math.max(300, chartData.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 34, left: 10, bottom: 5 }} barCategoryGap="28%">
                <defs>
                  <linearGradient id="gradCaleg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                  <filter id="barShadowPks" x="-20%" y="-40%" width="150%" height="180%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f1f3" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11.5, fill: '#4b5563', fontWeight: 500 }} axisLine={{ stroke: '#e8e9ec' }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#fafafa' }}
                  formatter={(value) => [Number(value).toLocaleString('id-ID'), 'Suara']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  contentStyle={{ borderRadius: 14, fontSize: 12, border: '1px solid #e8e9ec', boxShadow: '0 12px 32px rgba(16,24,40,0.12)', padding: '10px 14px' }}
                  labelStyle={{ fontWeight: 700, color: '#1a1d29', marginBottom: 4 }}
                />
                <Bar dataKey="total" fill="url(#gradCaleg)" radius={[0, 8, 8, 0]} filter="url(#barShadowPks)" maxBarSize={22}>
                  <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#1a1d29' }} formatter={(v) => v.toLocaleString('id-ID')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-card" style={{ padding: 24 }}>
          <CardHeader title="Distribusi Suara" subtitle="Proporsi suara caleg vs suara partai" icon={PieChartIcon} iconColor="#ea580c" iconBg="#fff7ed" />
          <div style={{ height: 300, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="donutShadowPks" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.14" />
                  </filter>
                </defs>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={62} outerRadius={94} paddingAngle={3} cornerRadius={8} filter="url(#donutShadowPks)">
                  {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />)}
                </Pie>
                <Tooltip formatter={(value) => Number(value).toLocaleString('id-ID')} contentStyle={{ borderRadius: 14, fontSize: 12, border: '1px solid #e8e9ec', boxShadow: '0 12px 32px rgba(16,24,40,0.12)', padding: '10px 14px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {(totalSuaraPartai).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 3 }}>Total Suara</div>
            </div>
          </div>
          <div className="p-scrollbar" style={{ marginTop: 10, maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pieData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: '#4b5563', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span style={{ color: '#1a1d29', fontWeight: 700 }}>{d.value.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-card" style={{ padding: 24, marginBottom: 24 }}>
        <CardHeader title="Peringkat Caleg" subtitle="Daftar lengkap seluruh caleg PKS beserta rincian suara per kelurahan" icon={Trophy} iconColor="#d97706" iconBg="#fffbeb" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {perCaleg.map((c, i) => {
            const rank = c.isPartyRow ? null : calegOnly.findIndex((x) => x.candidate_number === c.candidate_number);
            const rankColor = rank !== null && rank >= 0 ? (RANK_COLORS[rank] || '#94a3b8') : '#94a3b8';
            const pct = c.isPartyRow ? 0 : Math.max(4, (c.total / maxCaleg) * 100);
            const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null;
            return (
              <div key={c.candidate_number} style={{
                padding: '14px 16px', borderRadius: 14, border: '1px solid #eceef1',
                background: c.isPartyRow ? '#fffbeb' : 'linear-gradient(150deg, #ffffff 0%, #fafbfc 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: c.isPartyRow ? '#fde68a55' : rankColor + '1a', color: c.isPartyRow ? '#b45309' : rankColor,
                      fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {medal || (c.isPartyRow ? '★' : (rank >= 0 ? rank + 1 : c.candidate_number))}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1d29', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.isPartyRow ? 'Suara Partai (tanpa calon)' : `${c.candidate_number}. ${c.candidate_name}`}
                      </div>
                      {!c.isPartyRow && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Nomor urut {c.candidate_number}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                    {c.total.toLocaleString('id-ID')} <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>suara</span>
                  </div>
                </div>
                {!c.isPartyRow && (
                  <div style={{ marginTop: 10, height: 6, borderRadius: 4, background: '#f1f2f4', overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}cc)` }} />
                  </div>
                )}
                {c.perKelurahan.length > 1 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {c.perKelurahan.map((pk) => (
                      <span key={pk.kelurahan} className="p-badge" style={{ background: '#f4f5f7', color: '#4b5563', fontWeight: 600 }}>
                        {pk.kelurahan}: {pk.total.toLocaleString('id-ID')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-card" style={{ padding: 24 }}>
        <CardHeader title="Total Suara PKS per Kelurahan" subtitle="Jumlah seluruh suara (partai + caleg) yang sudah terekam per kelurahan" icon={MapPin} iconColor="#dc2626" iconBg="#fef2f2" />
        {perKelurahanTotal.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Belum ada data.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {perKelurahanTotal.map((w, i) => {
              const maxTotal = perKelurahanTotal[0].total || 1;
              const pct = Math.max(6, (w.total / maxTotal) * 100);
              const rankColor = RANK_COLORS[i] || '#94a3b8';
              return (
                <div key={w.nama} className="p-card-hover" style={{
                  position: 'relative', borderRadius: 16, padding: '18px 18px 16px',
                  background: 'linear-gradient(150deg, #ffffff 0%, #fafbfc 100%)', border: '1px solid #eceef1', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: -18, right: -18, width: 70, height: 70, borderRadius: '50%', background: `radial-gradient(circle, ${rankColor}22, transparent 70%)` }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, background: rankColor + '1a', color: rankColor, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1d29' }}>{w.nama}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 12, position: 'relative', zIndex: 1 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#1a1d29', letterSpacing: '-0.02em' }}>{w.total.toLocaleString('id-ID')}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>suara</span>
                  </div>
                  <div style={{ marginTop: 12, height: 6, borderRadius: 4, background: '#f1f2f4', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}cc)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const SLIDE_INTERVAL_MS = 8000;
const SLIDESHOW_GROUP_SIZE = 6;

// Widget-widget di tab Dashboard dipecah jadi "slide" terpisah (mirip slide show
// PPT) supaya bisa dipresentasikan layar penuh tanpa perlu bikin file PPT lagi.
// Daftar caleg & kelurahan yang panjang dipecah lagi per beberapa item per slide
// supaya tetap terbaca dari jarak jauh.
const PksSlideshow = ({
  onClose, selectedYear, dapilName, filterKelurahanName, kelurahanTercakupCount, kelurahanTotalCount,
  totalSuaraPartai, totalSuaraTanpaCalon, perCaleg, calegOnly, chartData, pieData, perKelurahanTotal,
  compareAvailable = false, compareYears = COMPARE_YEARS, compareTotals = {}, compareByKelurahan = [], compareByCaleg = [],
}) => {
  const containerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const slides = useMemo(() => {
    const list = [{ kind: 'cover' }, { kind: 'stats' }];
    if (chartData.length > 0) list.push({ kind: 'bar' });
    if (pieData.length > 0) list.push({ kind: 'pie' });
    const legerGroups = chunkArray(perCaleg, SLIDESHOW_GROUP_SIZE);
    legerGroups.forEach((group, i) => list.push({ kind: 'leaderboard', group, part: i + 1, totalParts: legerGroups.length }));
    const kelurahanGroups = chunkArray(perKelurahanTotal, SLIDESHOW_GROUP_SIZE);
    kelurahanGroups.forEach((group, i) => list.push({ kind: 'kelurahan', group, part: i + 1, totalParts: kelurahanGroups.length }));
    if (compareAvailable) {
      list.push({ kind: 'compare-total' });
      const compKelurahanGroups = chunkArray(compareByKelurahan, SLIDESHOW_GROUP_SIZE);
      compKelurahanGroups.forEach((group, i) => list.push({ kind: 'compare-kelurahan', group, part: i + 1, totalParts: compKelurahanGroups.length }));
      if (compareByCaleg.length > 0) {
        const compCalegGroups = chunkArray(compareByCaleg, SLIDESHOW_GROUP_SIZE);
        compCalegGroups.forEach((group, i) => list.push({ kind: 'compare-caleg', group, part: i + 1, totalParts: compCalegGroups.length }));
      }
    }
    return list;
  }, [chartData.length, pieData.length, perCaleg, perKelurahanTotal, compareAvailable, compareByKelurahan, compareByCaleg]);

  useEffect(() => { if (index > slides.length - 1) setIndex(0); }, [slides.length, index]);

  const goNext = useCallback(() => setIndex((i) => (i + 1 >= slides.length ? 0 : i + 1)), [slides.length]);
  const goPrev = useCallback(() => setIndex((i) => (i - 1 < 0 ? slides.length - 1 : i - 1)), [slides.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(goNext, SLIDE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [playing, goNext]);

  useEffect(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);

  const handleClose = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  };

  const slide = slides[index] || slides[0];
  const maxCaleg = calegOnly[0]?.total || 1;
  const maxKelurahan = perKelurahanTotal[0]?.total || 1;

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #14151c 0%, #2a1810 55%, #170a06 100%)', color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 34px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Vote size={16} color="#fdba74" />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fdba74', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Perolehan Suara PKS {selectedYear || ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, marginRight: 4 }}>{index + 1} / {slides.length}</span>
          <button onClick={() => setPlaying((p) => !p)} title={playing ? 'Jeda' : 'Putar otomatis'} style={slideIconBtnStyle}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={handleClose} title="Tutup (Esc)" style={slideIconBtnStyle}><X size={18} /></button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0, padding: '18px 60px 10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {slide.kind === 'cover' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fdba74', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Rekap Perolehan Suara Pileg {selectedYear || ''}
                </div>
                <h1 style={{ margin: 0, fontSize: 42, fontWeight: 800, letterSpacing: '-0.02em', maxWidth: 760 }}>
                  Partai Keadilan Sejahtera
                </h1>
                <p style={{ margin: '10px 0 0', fontSize: 16, color: '#d4d4d8' }}>{dapilName || 'DPRD Kota Balikpapan'}</p>
                <p style={{ margin: '22px 0 0', fontSize: 13, color: '#a1a1aa' }}>
                  {filterKelurahanName ? `Kelurahan: ${filterKelurahanName}` : `Seluruh kelurahan tercakup (${kelurahanTercakupCount} / ${kelurahanTotalCount})`}
                </p>
                <div style={{ marginTop: 36, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 64, fontWeight: 800, color: '#fb923c', letterSpacing: '-0.03em' }}>
                    {totalSuaraPartai.toLocaleString('id-ID')}
                  </span>
                  <span style={{ fontSize: 16, color: '#a1a1aa', fontWeight: 600 }}>total suara</span>
                </div>
              </div>
            )}

            {slide.kind === 'stats' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <SlideHeading title="Ringkasan Perolehan Suara" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 22, marginTop: 30 }}>
                  <SlideStat icon={Vote} label="Total Suara PKS" value={totalSuaraPartai.toLocaleString('id-ID')} color="#fb923c" />
                  <SlideStat icon={Trophy} label="Suara Partai (tanpa calon)" value={totalSuaraTanpaCalon.toLocaleString('id-ID')} color="#fbbf24" />
                  <SlideStat icon={Users} label="Caleg Terdaftar" value={calegOnly.length} color="#60a5fa" />
                  <SlideStat icon={MapPin} label="Kelurahan Tercakup" value={`${kelurahanTercakupCount} / ${kelurahanTotalCount}`} color="#f87171" />
                </div>
              </div>
            )}

            {slide.kind === 'bar' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <SlideHeading title="Perolehan Suara per Caleg" subtitle="Diurutkan dari yang terbanyak" />
                <div style={{ flex: 1, minHeight: 0, marginTop: 14 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }} barCategoryGap="26%">
                      <defs>
                        <linearGradient id="gradCalegSlide" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#fb923c" />
                          <stop offset="100%" stopColor="#ea580c" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 13, fill: '#e4e4e7', fontWeight: 600 }} axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        formatter={(value) => [Number(value).toLocaleString('id-ID'), 'Suara']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #27272a', background: '#18181b', color: '#fff' }}
                      />
                      <Bar dataKey="total" fill="url(#gradCalegSlide)" radius={[0, 8, 8, 0]} maxBarSize={30}>
                        <LabelList dataKey="total" position="right" style={{ fontSize: 12.5, fontWeight: 700, fill: '#fff' }} formatter={(v) => v.toLocaleString('id-ID')} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {slide.kind === 'pie' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <SlideHeading title="Distribusi Suara" subtitle="Proporsi suara caleg vs suara partai" />
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 40, marginTop: 10 }}>
                  <div style={{ flex: '0 0 auto', width: '46%', height: '100%', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={3} cornerRadius={8}>
                          {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#0f172a" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip formatter={(value) => Number(value).toLocaleString('id-ID')} contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #27272a', background: '#18181b', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {totalSuaraPartai.toLocaleString('id-ID')}
                      </div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, marginTop: 4 }}>Total Suara</div>
                    </div>
                  </div>
                  <div className="p-scrollbar" style={{ flex: 1, maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pieData.map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 4, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: '#d4d4d8', flex: 1 }}>{d.name}</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{d.value.toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {slide.kind === 'leaderboard' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <SlideHeading
                  title="Peringkat Caleg"
                  subtitle={slide.totalParts > 1 ? `Bagian ${slide.part} dari ${slide.totalParts}` : 'Daftar lengkap seluruh caleg PKS'}
                />
                <div className="p-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  {slide.group.map((c) => {
                    const rank = c.isPartyRow ? null : calegOnly.findIndex((x) => x.candidate_number === c.candidate_number);
                    const rankColor = rank !== null && rank >= 0 ? (RANK_COLORS[rank] || '#94a3b8') : '#94a3b8';
                    const pct = c.isPartyRow ? 0 : Math.max(4, (c.total / maxCaleg) * 100);
                    const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null;
                    return (
                      <div key={c.candidate_number} style={{
                        padding: '14px 18px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <span style={{
                              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                              background: rankColor + '26', color: rankColor,
                              fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {medal || (c.isPartyRow ? '★' : (rank >= 0 ? rank + 1 : c.candidate_number))}
                            </span>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.isPartyRow ? 'Suara Partai (tanpa calon)' : `${c.candidate_number}. ${c.candidate_name}`}
                            </div>
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                            {c.total.toLocaleString('id-ID')} <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>suara</span>
                          </div>
                        </div>
                        {!c.isPartyRow && (
                          <div style={{ marginTop: 10, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}cc)` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {slide.kind === 'kelurahan' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <SlideHeading
                  title="Total Suara PKS per Kelurahan"
                  subtitle={slide.totalParts > 1 ? `Bagian ${slide.part} dari ${slide.totalParts}` : 'Jumlah seluruh suara (partai + caleg) per kelurahan'}
                />
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginTop: 16, alignContent: 'start' }}>
                  {slide.group.map((w) => {
                    const globalRank = perKelurahanTotal.findIndex((x) => x.nama === w.nama);
                    const rankColor = RANK_COLORS[globalRank] || '#94a3b8';
                    const pct = Math.max(6, (w.total / maxKelurahan) * 100);
                    return (
                      <div key={w.nama} style={{
                        borderRadius: 16, padding: '18px 20px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 7, background: rankColor + '26', color: rankColor, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {globalRank >= 0 ? globalRank + 1 : '-'}
                          </span>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{w.nama}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                          <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{w.total.toLocaleString('id-ID')}</span>
                          <span style={{ fontSize: 11.5, color: '#a1a1aa', fontWeight: 500 }}>suara</span>
                        </div>
                        <div style={{ marginTop: 12, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}cc)` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {slide.kind === 'compare-total' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <SlideHeading
                  title={`Analisa Perbandingan ${compareYears[0]} vs ${compareYears[1]}`}
                  subtitle="Pertumbuhan perolehan suara PKS antar dua pemilu terakhir"
                  icon={GitCompare}
                />
                {(() => {
                  const oldTotal = compareTotals[compareYears[0]]?.totalSuara || 0;
                  const newTotal = compareTotals[compareYears[1]]?.totalSuara || 0;
                  const { pct, direction } = computeDelta(oldTotal, newTotal);
                  const trendColor = direction === 'up' ? '#4ade80' : direction === 'down' ? '#f87171' : '#a1a1aa';
                  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
                  const detailMetrics = [
                    { label: 'Suara Partai (tanpa calon)', key: 'totalPartai', icon: Trophy },
                    { label: 'Caleg Terdaftar', key: 'calegCount', icon: Users },
                    { label: 'Kelurahan Tercakup', key: 'kelurahanCount', icon: MapPin },
                  ];
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, margin: '26px 0 30px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 700 }}>{compareYears[0]}</div>
                          <div style={{ fontSize: 38, fontWeight: 800, color: '#cbd5e1', letterSpacing: '-0.02em' }}>{oldTotal.toLocaleString('id-ID')}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 46, height: 46, borderRadius: '50%', background: trendColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendIcon size={22} color={trendColor} strokeWidth={2.4} />
                          </div>
                          <span style={{ fontSize: 18, fontWeight: 800, color: trendColor }}>
                            {direction === 'up' ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#fb923c', fontWeight: 700 }}>{compareYears[1]}</div>
                          <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{newTotal.toLocaleString('id-ID')}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {detailMetrics.map((m) => {
                          const oldVal = compareTotals[compareYears[0]]?.[m.key] || 0;
                          const newVal = compareTotals[compareYears[1]]?.[m.key] || 0;
                          const Icon = m.icon;
                          return (
                            <div key={m.key} style={{
                              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', borderRadius: 14,
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 0 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(249,115,22,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Icon size={16} color="#fb923c" />
                                </div>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#e4e4e7' }}>{m.label}</span>
                              </div>
                              <div style={{ textAlign: 'right', minWidth: 84 }}>
                                <div style={{ fontSize: 10, color: '#71717a', fontWeight: 700 }}>{compareYears[0]}</div>
                                <div style={{ fontSize: 17, fontWeight: 700, color: '#a1a1aa' }}>{oldVal.toLocaleString('id-ID')}</div>
                              </div>
                              <ChevronRight size={16} color="#52525b" style={{ flexShrink: 0 }} />
                              <div style={{ textAlign: 'right', minWidth: 84 }}>
                                <div style={{ fontSize: 10, color: '#fb923c', fontWeight: 700 }}>{compareYears[1]}</div>
                                <div style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>{newVal.toLocaleString('id-ID')}</div>
                              </div>
                              <div style={{ minWidth: 88, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                                <DeltaBadge oldVal={oldVal} newVal={newVal} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {slide.kind === 'compare-kelurahan' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <SlideHeading
                  title={`Suara per Kelurahan — ${compareYears[0]} vs ${compareYears[1]}`}
                  subtitle={slide.totalParts > 1 ? `Bagian ${slide.part} dari ${slide.totalParts}` : 'Perbandingan total suara PKS tiap kelurahan'}
                  icon={GitCompare}
                />
                <div style={{ flex: 1, minHeight: 0, marginTop: 14 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={slide.group.map((k) => ({
                        name: k.nama,
                        [compareYears[0]]: k.values[compareYears[0]] || 0,
                        [compareYears[1]]: k.values[compareYears[1]] || 0,
                      }))}
                      margin={{ top: 24, right: 10, left: -10, bottom: 30 }}
                      barGap={6}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={56} tick={{ fontSize: 11.5, fill: '#d4d4d8', fontWeight: 600 }} axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
                      <Tooltip
                        formatter={(value) => [Number(value).toLocaleString('id-ID'), 'Suara']}
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #27272a', background: '#18181b', color: '#fff' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#d4d4d8' }} />
                      <Bar dataKey={compareYears[0]} fill="#64748b" radius={[6, 6, 0, 0]} maxBarSize={34} />
                      <Bar dataKey={compareYears[1]} fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={34}>
                        <LabelList dataKey={compareYears[1]} position="top" style={{ fontSize: 10.5, fontWeight: 700, fill: '#fdba74' }} formatter={(v) => v.toLocaleString('id-ID')} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {slide.kind === 'compare-caleg' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <SlideHeading
                  title="Caleg Petahana — Perbandingan Suara"
                  subtitle={slide.totalParts > 1 ? `Bagian ${slide.part} dari ${slide.totalParts}` : `Caleg yang maju di ${compareYears[0]} maupun ${compareYears[1]}`}
                  icon={GitCompare}
                />
                <div className="p-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  {slide.group.map((c) => {
                    const oldVal = c.values[compareYears[0]] || 0;
                    const newVal = c.values[compareYears[1]] || 0;
                    const maxVal = Math.max(oldVal, newVal, 1);
                    return (
                      <div key={c.key} style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{c.name}</span>
                          <DeltaBadge oldVal={oldVal} newVal={newVal} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10.5, color: '#a1a1aa', width: 42, fontWeight: 700, flexShrink: 0 }}>{compareYears[0]}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ width: `${(oldVal / maxVal) * 100}%`, height: '100%', borderRadius: 4, background: '#64748b' }} />
                            </div>
                            <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700, width: 68, textAlign: 'right', flexShrink: 0 }}>{oldVal.toLocaleString('id-ID')}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10.5, color: '#fb923c', width: 42, fontWeight: 700, flexShrink: 0 }}>{compareYears[1]}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ width: `${(newVal / maxVal) * 100}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #fb923c, #ea580c)' }} />
                            </div>
                            <span style={{ fontSize: 12, color: '#fff', fontWeight: 800, width: 68, textAlign: 'right', flexShrink: 0 }}>{newVal.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '14px 28px 30px', flexShrink: 0 }}>
        <button onClick={goPrev} style={slideNavBtnStyle} title="Sebelumnya (←)"><ChevronLeft size={22} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {slides.map((_, i) => (
            <span
              key={i}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 22 : 7, height: 7, borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
                background: i === index ? '#f97316' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
        <button onClick={goNext} style={slideNavBtnStyle} title="Berikutnya (→)"><ChevronRight size={22} /></button>
      </div>
    </div>
  );
};

const slideIconBtnStyle = {
  width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

const slideNavBtnStyle = {
  width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
};

const SlideHeading = ({ title, subtitle, icon: Icon }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
    {Icon && (
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(249,115,22,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <Icon size={16} color="#fb923c" />
      </div>
    )}
    <div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{title}</h2>
      {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>{subtitle}</p>}
    </div>
  </div>
);

const SlideStat = ({ icon: Icon, label, value, color }) => (
  <div style={{
    borderRadius: 18, padding: '24px 26px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
      <Icon size={20} color={color} strokeWidth={2.3} />
    </div>
    <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 8, fontWeight: 500 }}>{label}</div>
  </div>
);

const DeltaBadge = ({ oldVal, newVal }) => {
  const { pct, direction } = computeDelta(oldVal, newVal);
  const color = direction === 'up' ? '#4ade80' : direction === 'down' ? '#f87171' : '#a1a1aa';
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999,
      background: color + '1f', color, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      <Icon size={12} strokeWidth={2.6} /> {direction === 'flat' ? '0%' : `${direction === 'up' ? '+' : ''}${pct.toFixed(1)}%`}
    </span>
  );
};

const PksTpsDetail = ({ kelurahanList, kelurahanTercakup, candidateMasterList, selectedYear, toast }) => {
  const availableKelurahan = useMemo(
    () => kelurahanList.filter((k) => kelurahanTercakup.has(k.id)),
    [kelurahanList, kelurahanTercakup]
  );

  const [kelurahanId, setKelurahanId] = useState('');
  const [candidateFilter, setCandidateFilter] = useState('total');
  const [loading, setLoading] = useState(false);
  const [tpsRows, setTpsRows] = useState([]);
  const [hasData, setHasData] = useState(true);
  const [editingTps, setEditingTps] = useState(null); // { tps, values: { [candidate_number]: votes } } atau null
  const [addingTps, setAddingTps] = useState(false);
  const [savingTps, setSavingTps] = useState(false);
  // Tabel Rincian per TPS sengaja TIDAK diubah di layar sempit (PWA/HP) — kolom
  // caleg tetap sama rata (tableLayout fixed) supaya semua kolom kelihatan tanpa
  // scroll horizontal, meski nama caleg jadi terpotong per-huruf. Di layar desktop
  // kolom dilebarkan (tableLayout auto + minWidth) supaya nama caleg terbaca utuh,
  // sambil tetap pakai warna pastel per kolom yang sama seperti di HP.
  const [isDesktopTable, setIsDesktopTable] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 769px)');
    const handler = (e) => setIsDesktopTable(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    // availableKelurahan berubah kalau dapil aktif diganti — kalau kelurahan
    // yang sedang dipilih bukan lagi milik dapil ini, pindah ke pilihan
    // pertama yang valid supaya tidak diam-diam menampilkan data dapil lama.
    if (availableKelurahan.length === 0) { if (kelurahanId) setKelurahanId(''); return; }
    if (!availableKelurahan.some((k) => k.id === kelurahanId)) setKelurahanId(availableKelurahan[0].id);
  }, [availableKelurahan, kelurahanId]);

  const reloadTpsRows = React.useCallback(async () => {
    if (!kelurahanId || !selectedYear) return;
    setLoading(true);
    // PostgREST membatasi jumlah baris per request (default 1000), sedangkan
    // tabel ini punya 1 baris per kandidat per TPS — jadi kelurahan dengan
    // banyak TPS bisa melewati batas itu dalam satu request. Ambil per
    // halaman sampai habis supaya TPS di ujung tidak hilang diam-diam.
    const pageSize = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('pemilih_suara_caleg_tps')
        .select('tps_number, candidate_number, candidate_name, votes')
        .eq('kelurahan_id', kelurahanId)
        .eq('election_year', selectedYear)
        .order('tps_number')
        .range(from, from + pageSize - 1);
      if (error) {
        toast({ variant: 'destructive', title: 'Gagal memuat data per TPS', description: error.message });
        setTpsRows([]);
        setLoading(false);
        return;
      }
      allRows = allRows.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    setTpsRows(allRows);
    setHasData(allRows.length > 0);
    setLoading(false);
  }, [kelurahanId, selectedYear, toast]);

  useEffect(() => { reloadTpsRows(); }, [reloadTpsRows]);

  const openEditTps = (row) => {
    const values = {};
    candidateMasterList.forEach((c) => { values[c.number] = row.byCandidate[c.number] ?? ''; });
    setEditingTps({ tps: row.tps, values });
    setAddingTps(false);
  };

  const openAddTps = () => {
    const nextTps = table.length > 0 ? Math.max(...table.map((r) => r.tps)) + 1 : 1;
    const values = {};
    candidateMasterList.forEach((c) => { values[c.number] = ''; });
    setEditingTps({ tps: nextTps, values });
    setAddingTps(true);
  };

  const saveEditingTps = async () => {
    if (!editingTps) return;
    const tpsNumber = Number(editingTps.tps);
    if (!tpsNumber || tpsNumber < 1) {
      toast({ variant: 'destructive', title: 'Nomor TPS tidak valid' });
      return;
    }
    setSavingTps(true);
    const payload = candidateMasterList.map((c) => ({
      kelurahan_id: kelurahanId,
      tps_number: tpsNumber,
      candidate_number: c.number,
      candidate_name: c.number === 0 ? null : c.name,
      votes: Number(editingTps.values[c.number]) || 0,
      election_year: selectedYear,
    }));
    const { error } = await supabase
      .from('pemilih_suara_caleg_tps')
      .upsert(payload, { onConflict: 'kelurahan_id,tps_number,candidate_number,election_year' });
    setSavingTps(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan TPS', description: error.message });
      return;
    }
    toast({ title: `TPS ${String(tpsNumber).padStart(2, '0')} tersimpan` });
    setEditingTps(null);
    reloadTpsRows();
  };

  const table = useMemo(() => {
    const byTps = new Map();
    tpsRows.forEach((r) => {
      if (!byTps.has(r.tps_number)) byTps.set(r.tps_number, { tps: r.tps_number, byCandidate: {}, total: 0 });
      const row = byTps.get(r.tps_number);
      row.byCandidate[r.candidate_number] = r.votes;
      row.total += r.votes || 0;
    });
    return Array.from(byTps.values()).sort((a, b) => a.tps - b.tps);
  }, [tpsRows]);

  const candidateOptions = useMemo(
    () => [
      { value: 'total', label: 'Total (Partai + Semua Caleg)' },
      ...candidateMasterList.map((c) => ({
        value: String(c.number),
        label: c.number === 0 ? 'Suara Partai (tanpa calon)' : `${c.number}. ${c.name}`,
      })),
    ],
    [candidateMasterList]
  );

  const chartData = useMemo(() => {
    if (candidateFilter === 'total') {
      return table.map((r) => ({ name: `TPS ${String(r.tps).padStart(2, '0')}`, votes: r.total }));
    }
    const num = Number(candidateFilter);
    return table.map((r) => ({ name: `TPS ${String(r.tps).padStart(2, '0')}`, votes: r.byCandidate[num] || 0 }));
  }, [table, candidateFilter]);

  const selectedKelurahanName = availableKelurahan.find((k) => k.id === kelurahanId)?.nama || '';

  // Tabel ikut filter "Tampilkan" seperti grafik — kalau satu caleg dipilih,
  // kolom lain disembunyikan supaya tabel dan grafik selalu menunjukkan data
  // yang sama, dan kolom Total (jumlah semua caleg) disembunyikan karena tidak
  // relevan lagi saat hanya satu caleg yang ditampilkan.
  const displayedCandidates = useMemo(
    () => (candidateFilter === 'total' ? candidateMasterList : candidateMasterList.filter((c) => String(c.number) === candidateFilter)),
    [candidateMasterList, candidateFilter]
  );

  // Warna kolom dipetakan dari posisi caleg di daftar lengkap (bukan daftar yang sedang
  // ditampilkan) supaya warnanya tidak berubah-ubah saat filter "Tampilkan" diganti.
  const candidateColorMap = useMemo(() => {
    const map = {};
    candidateMasterList.forEach((c, i) => { map[c.number] = PASTEL_COLUMN_COLORS[i % PASTEL_COLUMN_COLORS.length]; });
    return map;
  }, [candidateMasterList]);

  const columnTotals = useMemo(() => {
    const byCandidate = {};
    candidateMasterList.forEach((c) => { byCandidate[c.number] = 0; });
    let total = 0;
    table.forEach((r) => {
      candidateMasterList.forEach((c) => { byCandidate[c.number] += r.byCandidate[c.number] || 0; });
      total += r.total;
    });
    return { byCandidate, total };
  }, [table, candidateMasterList]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ minWidth: 220 }}>
          <label className="p-label">Kelurahan</label>
          <PemilihSelect
            value={kelurahanId}
            onChange={setKelurahanId}
            options={availableKelurahan.map((k) => ({ value: k.id, label: k.nama }))}
            placeholder="Pilih Kelurahan"
            title="Pilih Kelurahan"
          />
        </div>
        <div style={{ minWidth: 260 }}>
          <label className="p-label">Tampilkan</label>
          <PemilihSelect
            value={candidateFilter}
            onChange={setCandidateFilter}
            options={candidateOptions}
            title="Pilih Caleg"
          />
        </div>
      </div>

      {availableKelurahan.length === 0 ? (
        <div className="p-card" style={{ padding: 50, textAlign: 'center' }}>
          <Table2 size={32} color="#d4d4d8" style={{ marginBottom: 10 }} />
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Belum ada data suara PKS sama sekali.</p>
        </div>
      ) : loading ? (
        <div style={{ padding: 80, textAlign: 'center' }}><Loader2 className="animate-spin" size={30} color="#ea580c" /></div>
      ) : !hasData ? (
        <div className="p-card" style={{ padding: 50, textAlign: 'center' }}>
          <ListFilter size={32} color="#d4d4d8" style={{ marginBottom: 10 }} />
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
            Rincian per TPS untuk <b>{selectedKelurahanName}</b> belum tersedia. Data ini hanya total per kelurahan (diinput manual).
            Upload ulang PDF kelurahan ini lewat tab "Upload PDF per Kelurahan" untuk mengisi rincian per TPS.
          </p>
        </div>
      ) : (
        <>
          <div className="p-card" style={{ padding: 24, marginBottom: 24 }}>
            <CardHeader
              title={`Suara per TPS — ${selectedKelurahanName}`}
              subtitle={`${table.length} TPS tercatat`}
              icon={BarChart3} iconColor="#ea580c" iconBg="#fff7ed"
            />
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }} barCategoryGap="24%">
                  <defs>
                    <linearGradient id="gradTps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fb923c" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f3" />
                  <XAxis dataKey="name" angle={-60} textAnchor="end" interval={Math.max(0, Math.floor(chartData.length / 30))} tick={{ fontSize: 9.5, fill: '#9ca3af' }} height={60} axisLine={{ stroke: '#e8e9ec' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                  <Tooltip
                    formatter={(value) => [Number(value).toLocaleString('id-ID'), 'Suara']}
                    contentStyle={{ borderRadius: 14, fontSize: 12, border: '1px solid #e8e9ec', boxShadow: '0 12px 32px rgba(16,24,40,0.12)', padding: '10px 14px' }}
                  />
                  <Bar dataKey="votes" fill="url(#gradTps)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <CardHeader title="Tabel Rincian per TPS" subtitle="Semua caleg langsung tampil sejajar — klik ikon pensil untuk koreksi angka" icon={Table2} iconColor="#2563eb" iconBg="#eff6ff" />
              <button className="p-btn-ghost" onClick={openAddTps} style={{ flexShrink: 0 }}>
                <Plus size={14} /> Tambah TPS
              </button>
            </div>
            <div className="p-table-wrap p-table-wrap-scroll">
              <table
                className="p-table"
                style={{
                  tableLayout: isDesktopTable ? 'auto' : 'fixed',
                  minWidth: 0, border: `1px solid ${TPS_TABLE_BORDER}`,
                }}
              >
                <thead className="p-table-sticky-head">
                  <tr>
                    <th style={{ width: 44, textAlign: 'center', verticalAlign: 'middle', fontWeight: 900, letterSpacing: '-0.01em', color: '#1a1d29', border: `1px solid ${TPS_TABLE_BORDER}` }}>TPS</th>
                    {displayedCandidates.map((c) => (
                      <th
                        key={c.number}
                        style={{
                          textAlign: 'center', whiteSpace: 'normal',
                          wordBreak: isDesktopTable ? 'normal' : 'break-word',
                          overflowWrap: 'break-word',
                          minWidth: isDesktopTable ? 78 : undefined,
                          fontSize: isDesktopTable ? 11 : 9.5, lineHeight: 1.25,
                          verticalAlign: 'middle', fontWeight: 900, letterSpacing: '-0.01em', color: '#1a1d29',
                          padding: isDesktopTable ? '10px 8px' : '10px 4px',
                          border: `1px solid ${TPS_TABLE_BORDER}`, background: candidateColorMap[c.number],
                        }}
                        title={c.number === 0 ? 'Suara Partai (tanpa calon)' : c.name}
                      >
                        {c.number === 0 ? 'Partai' : c.name}
                      </th>
                    ))}
                    {candidateFilter === 'total' && <th style={{ textAlign: 'center', verticalAlign: 'middle', width: 60, fontWeight: 900, letterSpacing: '-0.01em', color: '#1a1d29', border: `1px solid ${TPS_TABLE_BORDER}` }}>Total</th>}
                    <th style={{ width: 28, border: `1px solid ${TPS_TABLE_BORDER}` }}></th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr key={r.tps}>
                      <td style={{ fontWeight: 700, padding: '10px 6px', textAlign: 'center', border: `1px solid ${TPS_TABLE_BORDER}` }}>{String(r.tps).padStart(2, '0')}</td>
                      {displayedCandidates.map((c) => (
                        <td key={c.number} style={{ textAlign: 'center', fontFamily: 'monospace', color: '#4b5563', padding: '10px 4px', fontSize: 12, minWidth: isDesktopTable ? 78 : undefined, border: `1px solid ${TPS_TABLE_BORDER}`, background: candidateColorMap[c.number] }}>
                          {r.byCandidate[c.number] ?? '-'}
                        </td>
                      ))}
                      {candidateFilter === 'total' && <td style={{ textAlign: 'center', fontWeight: 800, padding: '10px 4px', border: `1px solid ${TPS_TABLE_BORDER}` }}>{r.total.toLocaleString('id-ID')}</td>}
                      <td style={{ textAlign: 'center', padding: '10px 4px', border: `1px solid ${TPS_TABLE_BORDER}` }}>
                        <button onClick={() => openEditTps(r)} style={{ color: '#2563eb', padding: 4 }} title="Koreksi angka TPS ini">
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 800, padding: '10px 6px', textAlign: 'center', border: `1px solid ${TPS_TABLE_BORDER}` }}>Total</td>
                    {displayedCandidates.map((c) => (
                      <td key={c.number} style={{ textAlign: 'center', fontWeight: 800, padding: '10px 4px', fontSize: 12, minWidth: isDesktopTable ? 78 : undefined, border: `1px solid ${TPS_TABLE_BORDER}`, background: candidateColorMap[c.number] }}>
                        {columnTotals.byCandidate[c.number].toLocaleString('id-ID')}
                      </td>
                    ))}
                    {candidateFilter === 'total' && <td style={{ textAlign: 'center', fontWeight: 800, padding: '10px 4px', border: `1px solid ${TPS_TABLE_BORDER}` }}>{columnTotals.total.toLocaleString('id-ID')}</td>}
                    <td style={{ border: `1px solid ${TPS_TABLE_BORDER}` }}></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 10.5, color: '#9ca3af' }}>
              Kolom "Partai" menunjukkan suara partai tanpa calon; baris terakhir adalah total seluruh TPS.
            </p>
          </div>
        </>
      )}

      {editingTps && (
        <div className="p-modal-overlay" onClick={() => setEditingTps(null)}>
          <div className="p-modal" style={{ padding: 26, width: 440, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 15.5 }}>
                {addingTps ? 'Tambah TPS' : `Koreksi TPS ${String(editingTps.tps).padStart(2, '0')}`}
              </h3>
              <button onClick={() => setEditingTps(null)} style={{ color: '#9ca3af' }}><X size={19} /></button>
            </div>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 12.5 }}>
              {selectedKelurahanName} — Tahun {selectedYear}. Kosongkan/isi 0 kalau tidak ada suara.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addingTps && (
                <div>
                  <label className="p-label">Nomor TPS</label>
                  <input
                    type="number" className="p-input" min={1}
                    value={editingTps.tps}
                    onChange={(e) => setEditingTps({ ...editingTps, tps: e.target.value })}
                  />
                </div>
              )}
              <div className="p-scrollbar" style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                {candidateMasterList.map((c) => (
                  <div key={c.number} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ flex: 1, fontSize: 12.5, color: '#4b5563' }}>
                      {c.number === 0 ? 'Suara Partai (tanpa calon)' : `${c.number}. ${c.name}`}
                    </label>
                    <input
                      type="number" className="p-input" style={{ width: 90, textAlign: 'right' }} min={0}
                      value={editingTps.values[c.number]}
                      onChange={(e) => setEditingTps({ ...editingTps, values: { ...editingTps.values, [c.number]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <button className="p-btn-primary" style={{ marginTop: 18, width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #f97316, #ea580c)' }} onClick={saveEditingTps} disabled={savingTps}>
              {savingTps ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PksUpload = ({ kelurahanList, onSaved, toast, defaultYear }) => {
  const fileInputRef = useRef(null);
  const cancelRef = useRef(false);

  const [kelurahanId, setKelurahanId] = useState('');
  const [electionYear, setElectionYear] = useState(defaultYear || 2024);
  useEffect(() => { if (defaultYear) setElectionYear(defaultYear); }, [defaultYear]);
  // kelurahanList berubah kalau dapil aktif diganti — kalau kelurahan yang
  // sedang dipilih bukan lagi milik dapil ini, kosongkan supaya upload tidak
  // diam-diam tersimpan ke kelurahan dapil yang lain.
  useEffect(() => {
    if (kelurahanId && !kelurahanList.some((k) => k.id === kelurahanId)) setKelurahanId('');
  }, [kelurahanList, kelurahanId]);
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(1);
  const [rotate, setRotate] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pageResults, setPageResults] = useState([]);
  const [saving, setSaving] = useState(false);
  // Isian manual untuk sel yang OCR tidak yakin membacanya (nilainya null),
  // key: `${candidateKey}::${tpsNumber}` -> string angka dari input pengguna.
  // Ini sengaja terpisah dari data OCR supaya sel yang SUDAH terbaca tidak
  // perlu disentuh sama sekali — pengguna hanya mengisi yang benar-benar kosong.
  const [manualOverrides, setManualOverrides] = useState({});

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPageResults([]);
    setManualOverrides({});
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      setNumPages(pdf.numPages);
      setPageFrom(1);
      setPageTo(pdf.numPages);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membaca PDF', description: err.message });
    }
  };

  const handleCancel = () => { cancelRef.current = true; };

  const handleProcess = async () => {
    if (!file) return;
    if (!kelurahanId) {
      toast({ variant: 'destructive', title: 'Pilih kelurahan dulu', description: 'Tentukan PDF ini data untuk kelurahan mana.' });
      return;
    }
    const from = Math.max(1, Math.min(pageFrom, numPages));
    const to = Math.max(from, Math.min(pageTo, numPages));
    const pageNumbers = [];
    for (let i = from; i <= to; i++) pageNumbers.push(i);

    setProcessing(true);
    cancelRef.current = false;
    setPageResults([]);
    setManualOverrides({});
    setProgress({ done: 0, total: pageNumbers.length });

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const results = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < pageNumbers.length) {
        if (cancelRef.current) return;
        const idx = cursor++;
        const pageNumber = pageNumbers[idx];
        let lastError = null;
        let merged = null;
        // Kalau percobaan gagal total (dua potongan sekaligus) karena timeout,
        // mengulang dengan budget waktu yang sama nyaris pasti timeout lagi
        // juga — jadi tidak retry pada kasus itu. Tapi kalau sudah dapat hasil
        // sebagian (satu potongan berhasil), langsung dipakai — tidak perlu
        // mengulang dari nol.
        for (let attempt = 0; attempt < 2 && !merged; attempt++) {
          let isTimeout = false;
          try {
            const pageCanvas = await renderPageCanvas(pdf, pageNumber, rotate);
            const [topCanvas, bottomCanvas] = splitCanvasForOcr(pageCanvas);
            if (cancelRef.current) return;
            const [topSettled, bottomSettled] = await Promise.allSettled([
              callOcrHalf(canvasToBase64(topCanvas), PARTY_FILTER, true, INVOKE_TIMEOUT_MS),
              callOcrHalf(canvasToBase64(bottomCanvas), PARTY_FILTER, true, INVOKE_TIMEOUT_MS),
            ]);
            if (cancelRef.current) return;
            const topData = topSettled.status === 'fulfilled' ? topSettled.value : null;
            const bottomData = bottomSettled.status === 'fulfilled' ? bottomSettled.value : null;
            if (!topData && !bottomData) {
              throw new Error(topSettled.reason?.message || bottomSettled.reason?.message || 'Gagal memproses halaman');
            }
            merged = mergePageHalves(topData, bottomData);
            if (!topData || !bottomData) {
              const halfErrMsg = (topSettled.reason || bottomSettled.reason)?.message;
              lastError = halfErrMsg ? `Sebagian halaman mungkin belum terbaca lengkap: ${halfErrMsg}` : null;
            }
          } catch (err) {
            lastError = err.message;
            isTimeout = /waktu tunggu|tidak merespons/i.test(err.message || '');
          }
          if (isTimeout) break;
        }
        if (merged) {
          results.push({ pageNumber, ...merged, error: lastError || undefined });
        } else {
          results.push({ pageNumber, is_vote_table: false, rows: [], column_headers: [], error: lastError });
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    results.sort((a, b) => a.pageNumber - b.pageNumber);
    setPageResults(results);
    setProcessing(false);
    if (cancelRef.current) {
      toast({ title: 'Ekstraksi dibatalkan' });
    } else {
      const tableCount = results.filter((r) => r.is_vote_table).length;
      toast({ title: 'Ekstraksi selesai', description: `${tableCount} dari ${results.length} halaman memuat tabel suara.` });
    }
  };

  // Kumpulkan baris PKS dari semua halaman, lalu ambil nilai "total" (kolom
  // JUMLAH PINDAHAN/AKHIR) dari halaman bernomor terbesar sebagai total akhir —
  // kolom itu sendiri sudah kumulatif berjalan dari halaman-halaman sebelumnya.
  const pksResult = useMemo(() => {
    const groups = new Map();
    pageResults.forEach((page) => {
      if (!page.is_vote_table) return;
      (page.rows || []).forEach((row) => {
        if (!PARTY_MATCH.test(row.party_name || '')) return;
        const isPartyRow = !!row.is_party_row && !row.candidate_name;
        const key = isPartyRow ? 'party' : `cand::${normalize(row.candidate_name)}`;
        const existing = groups.get(key);
        if (!existing || page.pageNumber > existing.pageNumber) {
          groups.set(key, {
            key,
            isPartyRow,
            candidateNumber: row.candidate_number ? Number(row.candidate_number) : (isPartyRow ? 0 : null),
            candidateName: isPartyRow ? null : row.candidate_name,
            total: row.total ?? null,
            pageNumber: page.pageNumber,
          });
        }
      });
    });
    const items = Array.from(groups.values()).sort((a, b) => (a.candidateNumber ?? 99) - (b.candidateNumber ?? 99));
    const sheetInfo = pageResults.find((p) => p.is_vote_table)?.sheet_info || null;
    return { items, sheetInfo };
  }, [pageResults]);

  // Rincian suara per TPS per caleg — kolom "TPS 01".."TPS NN" pada tiap
  // halaman (bukan kolom "JUMLAH PINDAHAN/AKHIR", itu cuma total berjalan).
  // key sama dengan pksResult.items[].key supaya gampang dipasangkan saat simpan.
  // Sel yang OCR tidak yakin membacanya TETAP dicatat (nilainya null), bukan
  // dilewati begitu saja, supaya bisa ditandai untuk diisi manual di panel
  // "Sel Perlu Diperiksa" alih-alih diam-diam hilang dari data.
  const pksTpsByCandidate = useMemo(() => {
    const perCandidate = new Map();
    pageResults.forEach((page) => {
      if (!page.is_vote_table) return;
      const headers = page.column_headers || [];
      (page.rows || []).forEach((row) => {
        if (!PARTY_MATCH.test(row.party_name || '')) return;
        const isPartyRow = !!row.is_party_row && !row.candidate_name;
        const key = isPartyRow ? 'party' : `cand::${normalize(row.candidate_name)}`;
        if (!perCandidate.has(key)) perCandidate.set(key, new Map());
        const tpsMap = perCandidate.get(key);
        const values = row.values || [];
        headers.forEach((h, i) => {
          const m = /TPS\s*0*(\d+)/i.exec(h || '');
          if (!m) return;
          const tpsNumber = parseInt(m[1], 10);
          const votes = values[i];
          if (votes === null || votes === undefined) {
            if (!tpsMap.has(tpsNumber)) tpsMap.set(tpsNumber, null);
            return;
          }
          tpsMap.set(tpsNumber, votes);
        });
      });
    });
    return perCandidate;
  }, [pageResults]);

  // Daftar sel (TPS x caleg) yang OCR tidak yakin membacanya dan belum diisi
  // manual — inilah satu-satunya bagian yang perlu disentuh pengguna, bukan
  // seluruh tabel. Halaman yang gagal total tidak muncul di sini karena kita
  // tidak tahu rentang TPS-nya sama sekali (lihat catatan di handleProcess).
  const uncertainCells = useMemo(() => {
    const out = [];
    pksTpsByCandidate.forEach((tpsMap, key) => {
      const item = pksResult.items.find((it) => it.key === key);
      const label = item ? (item.isPartyRow ? 'Suara Partai (tanpa calon)' : item.candidateName) : key;
      tpsMap.forEach((votes, tpsNumber) => {
        if (votes !== null) return;
        const overrideKey = `${key}::${tpsNumber}`;
        out.push({ overrideKey, tpsNumber, label });
      });
    });
    return out
      .filter((c) => manualOverrides[c.overrideKey] === undefined || manualOverrides[c.overrideKey] === '')
      .sort((a, b) => a.tpsNumber - b.tpsNumber || a.label.localeCompare(b.label));
  }, [pksTpsByCandidate, pksResult.items, manualOverrides]);

  // Total resmi ambil dari kolom "JUMLAH PINDAHAN/AKHIR" (running total yang
  // dicetak dokumen). Kalau itu null (OCR tidak yakin di halaman terakhir),
  // fallback ke jumlah semua nilai per-TPS (termasuk yang sudah diisi manual)
  // — tapi HANYA kalau semua sel TPS caleg itu sudah terisi (baik dari OCR
  // atau isian manual), supaya tidak diam-diam menyimpan total yang salah
  // karena masih ada sel yang bolong.
  const effectiveTotals = useMemo(() => {
    const out = {};
    pksResult.items.forEach((it) => {
      if (it.total !== null && it.total !== undefined) { out[it.key] = { value: it.total, isFallback: false }; return; }
      const tpsMap = pksTpsByCandidate.get(it.key);
      if (!tpsMap || tpsMap.size === 0) { out[it.key] = { value: null, isFallback: false }; return; }
      let sum = 0;
      let complete = true;
      tpsMap.forEach((votes, tpsNumber) => {
        const overrideRaw = manualOverrides[`${it.key}::${tpsNumber}`];
        const val = overrideRaw !== undefined && overrideRaw !== '' ? Number(overrideRaw) : votes;
        if (val === null || val === undefined || Number.isNaN(val)) { complete = false; return; }
        sum += val;
      });
      out[it.key] = { value: complete ? sum : null, isFallback: true };
    });
    return out;
  }, [pksResult.items, pksTpsByCandidate, manualOverrides]);

  const handleSave = async () => {
    if (!kelurahanId) return;
    if (pksResult.items.length === 0) {
      toast({ variant: 'destructive', title: 'Tidak ada data PKS untuk disimpan' });
      return;
    }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const payload = pksResult.items
      .filter((it) => effectiveTotals[it.key]?.value !== null && effectiveTotals[it.key]?.value !== undefined)
      .map((it) => ({
        kelurahan_id: kelurahanId,
        party_name: 'Partai Keadilan Sejahtera',
        candidate_number: it.candidateNumber ?? 0,
        candidate_name: it.candidateName,
        total_suara: effectiveTotals[it.key].value,
        source_file_name: file?.name || null,
        sheet_info: pksResult.sheetInfo,
        election_year: electionYear,
        updated_by: authData?.user?.id || null,
        updated_at: new Date().toISOString(),
      }));
    const { error } = await supabase.from('pemilih_suara_caleg').upsert(payload, { onConflict: 'kelurahan_id,candidate_number,election_year' });
    if (error) {
      setSaving(false);
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }

    const tpsPayload = [];
    pksResult.items.forEach((it) => {
      const tpsMap = pksTpsByCandidate.get(it.key);
      if (!tpsMap) return;
      tpsMap.forEach((votes, tpsNumber) => {
        const overrideRaw = manualOverrides[`${it.key}::${tpsNumber}`];
        const finalVotes = overrideRaw !== undefined && overrideRaw !== '' ? Number(overrideRaw) : votes;
        if (finalVotes === null || finalVotes === undefined || Number.isNaN(finalVotes)) return; // masih kosong, jangan disimpan sebagai 0 diam-diam
        tpsPayload.push({
          kelurahan_id: kelurahanId,
          tps_number: tpsNumber,
          candidate_number: it.candidateNumber ?? 0,
          candidate_name: it.candidateName,
          votes: finalVotes,
          election_year: electionYear,
        });
      });
    });
    for (let i = 0; i < tpsPayload.length; i += 500) {
      const { error: tpsError } = await supabase
        .from('pemilih_suara_caleg_tps')
        .upsert(tpsPayload.slice(i, i + 500), { onConflict: 'kelurahan_id,tps_number,candidate_number,election_year' });
      if (tpsError) {
        setSaving(false);
        toast({ variant: 'destructive', title: 'Total tersimpan, tapi rincian per TPS gagal', description: tpsError.message });
        onSaved();
        return;
      }
    }

    setSaving(false);
    toast({ title: 'Data tersimpan', description: `${payload.length} baris total + ${tpsPayload.length} baris rincian per TPS disimpan.` });
    onSaved();
  };

  return (
    <div>
      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="p-label">Data ini untuk kelurahan mana?</label>
            <PemilihSelect
              value={kelurahanId}
              onChange={setKelurahanId}
              options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
              placeholder="Pilih Kelurahan"
              title="Pilih Kelurahan"
            />
          </div>
          <div style={{ width: 140 }}>
            <label className="p-label">Tahun Pemilu</label>
            <PemilihSelect
              value={String(electionYear)}
              onChange={(v) => setElectionYear(Number(v))}
              options={[2019, 2024].map((y) => ({ value: String(y), label: String(y) }))}
              title="Pilih Tahun"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
          <button className="p-btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={processing}>
            <FileUp size={15} /> {file ? 'Ganti File PDF' : 'Pilih File PDF (Model DAA1-DPRD)'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />
          {file && (
            <span style={{ fontSize: 12.5, color: '#6b7280' }}>{file.name} — {numPages} halaman</span>
          )}
        </div>

        {file && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16 }}>
            <div>
              <label className="p-label">Halaman awal</label>
              <input type="number" className="p-input" style={{ width: 100 }} min={1} max={numPages} value={pageFrom} onChange={(e) => setPageFrom(Number(e.target.value) || 1)} disabled={processing} />
            </div>
            <div>
              <label className="p-label">Halaman akhir</label>
              <input type="number" className="p-input" style={{ width: 100 }} min={1} max={numPages} value={pageTo} onChange={(e) => setPageTo(Number(e.target.value) || numPages)} disabled={processing} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#4b5563', marginBottom: 10 }}>
              <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} disabled={processing} />
              Putar halaman 90°
            </label>
            {!processing ? (
              <button className="p-btn-primary" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }} onClick={handleProcess}>
                <Search size={15} /> Mulai Ekstrak
              </button>
            ) : (
              <button className="p-btn-ghost" onClick={handleCancel} style={{ color: '#dc2626' }}>
                <X size={15} /> Batalkan
              </button>
            )}
          </div>
        )}

        {processing && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#6b7280', marginBottom: 6 }}>
              <Loader2 className="animate-spin" size={14} /> Memproses halaman {progress.done} dari {progress.total}...
            </div>
            <div style={{ height: 6, borderRadius: 4, background: '#f1f2f4', overflow: 'hidden' }}>
              <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #fb923c, #ea580c)', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}
      </div>

      {!processing && pageResults.length > 0 && (
        <div className="p-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Hasil Ekstraksi — Partai Keadilan Sejahtera</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                {pageResults.filter((r) => r.is_vote_table).length} dari {pageResults.length} halaman terbaca sebagai tabel suara.
                {pksResult.sheetInfo?.desa_kelurahan && ` Terdeteksi: ${pksResult.sheetInfo.desa_kelurahan}.`}
              </p>
            </div>
            <button className="p-btn-primary" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }} onClick={handleSave} disabled={saving || pksResult.items.length === 0}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan ke Database
            </button>
          </div>

          {pageResults.some((r) => r.error) && (
            <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
              {[...new Set(pageResults.filter((r) => r.error).map((r) => r.error))].map((msg, i) => (
                <p key={i} style={{ margin: i ? '6px 0 0' : 0, fontSize: 11.5, color: '#991b1b' }}>
                  Halaman {pageResults.filter((r) => r.error === msg).map((r) => r.pageNumber).join(', ')}: {msg}
                </p>
              ))}
            </div>
          )}

          {pksResult.items.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Tidak ditemukan baris Partai Keadilan Sejahtera pada halaman yang diproses. Pastikan halaman yang diupload memuat tabel "DATA PEROLEHAN SUARA PARTAI POLITIK DAN CALON" untuk partai tersebut.
            </p>
          ) : (
            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nama Calon</th>
                    <th style={{ textAlign: 'right' }}>Total Suara</th>
                    <th>Sumber</th>
                  </tr>
                </thead>
                <tbody>
                  {pksResult.items.map((it) => {
                    const eff = effectiveTotals[it.key] || { value: null, isFallback: false };
                    return (
                      <tr key={it.key}>
                        <td>{it.isPartyRow ? '—' : it.candidateNumber}</td>
                        <td style={{ fontWeight: 700, color: '#1a1d29' }}>{it.isPartyRow ? 'Suara Partai (tanpa calon)' : it.candidateName}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          {eff.value === null || eff.value === undefined ? '?' : eff.value.toLocaleString('id-ID')}
                          {eff.isFallback && eff.value !== null && (
                            <span title="Dihitung dari jumlah semua TPS, bukan dari kolom total dokumen (nilainya tidak terbaca jelas)" style={{ marginLeft: 5, fontSize: 10, color: '#d97706', fontWeight: 600 }}>∑</span>
                          )}
                        </td>
                        <td style={{ color: '#9ca3af', fontSize: 11.5 }}>Halaman {it.pageNumber}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ fontWeight: 800 }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>
                      {pksResult.items.reduce((s, it) => s + (effectiveTotals[it.key]?.value || 0), 0).toLocaleString('id-ID')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {uncertainCells.length > 0 && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Pencil size={15} color="#b45309" />
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#92400e' }}>
                  Sel Perlu Diperiksa ({uncertainCells.length})
                </h4>
              </div>
              <p style={{ margin: '2px 0 12px', fontSize: 11.5, color: '#92400e' }}>
                Angka berikut tidak terbaca jelas oleh OCR — cek dokumen aslinya lalu isi di sini. Sel lain yang sudah berhasil terbaca tidak perlu diubah.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {uncertainCells.map((c) => (
                  <div key={c.overrideKey} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '8px 10px', border: '1px solid #fed7aa' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>TPS {String(c.tpsNumber).padStart(2, '0')}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1d29', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</div>
                    </div>
                    <input
                      type="number" className="p-input" style={{ width: 76, padding: '6px 8px', fontSize: 12.5 }}
                      placeholder="?" min={0}
                      value={manualOverrides[c.overrideKey] ?? ''}
                      onChange={(e) => setManualOverrides((prev) => ({ ...prev, [c.overrideKey]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <CheckCircle2 size={16} color="#ea580c" />
            <span style={{ fontSize: 12, color: '#9a3412' }}>
              Klik "Simpan ke Database" untuk menyimpan/memperbarui total suara kelurahan ini. Mengunggah ulang PDF yang sama akan menimpa data sebelumnya.
            </span>
          </div>
        </div>
      )}

      {!processing && pageResults.length === 0 && (
        <div className="p-card" style={{ padding: 40, textAlign: 'center' }}>
          <RefreshCw size={26} color="#d4d4d8" style={{ marginBottom: 10 }} />
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
            Pilih kelurahan, upload PDF Model DAA1-DPRD kelurahan tersebut, lalu klik "Mulai Ekstrak".
          </p>
        </div>
      )}
    </div>
  );
};

// Input manual penuh (tanpa PDF/OCR sama sekali): admin menentukan daftar
// caleg + jumlah TPS untuk satu kelurahan, lalu mengisi angka suara tiap
// caleg per TPS langsung di satu tabel. Dipakai baik untuk mengisi kelurahan
// yang belum pernah punya data sama sekali, maupun untuk mengoreksi data
// yang sudah ada (form ini otomatis memuat ulang data existing kalau ada).
const PksManualInput = ({ kelurahanList, candidateMasterList, onSaved, toast, defaultYear }) => {
  const [kelurahanId, setKelurahanId] = useState('');
  const [electionYear, setElectionYear] = useState(defaultYear || 2024);
  useEffect(() => { if (defaultYear) setElectionYear(defaultYear); }, [defaultYear]);
  useEffect(() => {
    // kelurahanList berubah kalau dapil aktif diganti — kalau kelurahan yang
    // sedang dipilih bukan lagi milik dapil ini, pindah ke pilihan pertama
    // yang valid supaya input manual tidak diam-diam tersimpan ke kelurahan
    // dapil yang lain.
    if (kelurahanList.length === 0) { if (kelurahanId) setKelurahanId(''); return; }
    if (!kelurahanList.some((k) => k.id === kelurahanId)) setKelurahanId(kelurahanList[0].id);
  }, [kelurahanList, kelurahanId]);

  const [candidates, setCandidates] = useState([]);
  const [jumlahTps, setJumlahTps] = useState(1);
  const [votes, setVotes] = useState({});
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const nextIdRef = useRef(1);
  const newCandidateId = () => `c${nextIdRef.current++}`;

  // Setiap ganti kelurahan/tahun: kalau kelurahan ini sudah punya rincian per
  // TPS (baik dari upload PDF maupun input manual sebelumnya), muat itu untuk
  // dikoreksi. Kalau belum ada sama sekali, mulai dari daftar caleg yang sudah
  // tercatat di tahun ini (dari kelurahan lain) supaya nama caleg tidak perlu
  // diketik ulang tiap pindah kelurahan.
  useEffect(() => {
    if (!kelurahanId || !electionYear) return;
    let cancelled = false;
    setLoadingExisting(true);
    fetchAllTpsRows(() =>
      supabase
        .from('pemilih_suara_caleg_tps')
        .select('tps_number, candidate_number, candidate_name, votes')
        .eq('kelurahan_id', kelurahanId)
        .eq('election_year', electionYear)
        .order('tps_number')
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast({ variant: 'destructive', title: 'Gagal memuat data existing', description: error.message });
          setLoadingExisting(false);
          return;
        }
        const existingRows = data || [];
        if (existingRows.length > 0) {
          const candMap = new Map();
          let maxTps = 1;
          existingRows.forEach((r) => {
            if (r.candidate_number !== 0 && !candMap.has(r.candidate_number)) {
              candMap.set(r.candidate_number, { id: `n${r.candidate_number}`, number: r.candidate_number, name: r.candidate_name || '' });
            }
            if (r.tps_number > maxTps) maxTps = r.tps_number;
          });
          const newVotes = {};
          existingRows.forEach((r) => {
            const id = r.candidate_number === 0 ? 'party' : `n${r.candidate_number}`;
            newVotes[`${id}::${r.tps_number}`] = String(r.votes ?? '');
          });
          setCandidates(Array.from(candMap.values()).sort((a, b) => a.number - b.number));
          setJumlahTps(maxTps);
          setVotes(newVotes);
        } else {
          const seeded = candidateMasterList
            .filter((c) => c.number !== 0)
            .map((c) => ({ id: `n${c.number}`, number: c.number, name: c.name }));
          setCandidates(seeded);
          setJumlahTps(1);
          setVotes({});
        }
        setLoadingExisting(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelurahanId, electionYear]);

  const addCandidate = () => {
    const maxNum = candidates.reduce((m, c) => Math.max(m, Number(c.number) || 0), 0);
    setCandidates((prev) => [...prev, { id: newCandidateId(), number: maxNum + 1, name: '' }]);
  };

  const removeCandidate = (id) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setVotes((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (k.startsWith(`${id}::`)) delete next[k]; });
      return next;
    });
  };

  const updateCandidate = (id, field, value) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const setVote = (candId, tps, value) => {
    setVotes((prev) => ({ ...prev, [`${candId}::${tps}`]: value }));
  };

  const columnIds = useMemo(() => ['party', ...candidates.map((c) => c.id)], [candidates]);
  const tpsNumbers = useMemo(() => Array.from({ length: Math.max(0, Number(jumlahTps) || 0) }, (_, i) => i + 1), [jumlahTps]);

  const rowTotals = useMemo(() => {
    const out = {};
    tpsNumbers.forEach((tps) => {
      out[tps] = columnIds.reduce((sum, id) => sum + (Number(votes[`${id}::${tps}`]) || 0), 0);
    });
    return out;
  }, [votes, columnIds, tpsNumbers]);

  const columnTotals = useMemo(() => {
    const out = {};
    columnIds.forEach((id) => {
      out[id] = tpsNumbers.reduce((sum, tps) => sum + (Number(votes[`${id}::${tps}`]) || 0), 0);
    });
    return out;
  }, [votes, columnIds, tpsNumbers]);

  const grandTotal = useMemo(() => columnIds.reduce((s, id) => s + (columnTotals[id] || 0), 0), [columnIds, columnTotals]);

  const selectedKelurahanName = kelurahanList.find((k) => k.id === kelurahanId)?.nama || '';

  const handleSave = async () => {
    if (!kelurahanId) { toast({ variant: 'destructive', title: 'Pilih kelurahan dulu' }); return; }
    if (candidates.length === 0) { toast({ variant: 'destructive', title: 'Tambahkan minimal satu caleg' }); return; }
    const numbers = candidates.map((c) => Number(c.number));
    if (numbers.some((n) => !n || n <= 0)) { toast({ variant: 'destructive', title: 'Ada nomor urut caleg yang tidak valid' }); return; }
    if (new Set(numbers).size !== numbers.length) { toast({ variant: 'destructive', title: 'Ada nomor urut caleg yang duplikat' }); return; }
    if (candidates.some((c) => !c.name.trim())) { toast({ variant: 'destructive', title: 'Nama caleg tidak boleh kosong' }); return; }
    if (!jumlahTps || jumlahTps < 1) { toast({ variant: 'destructive', title: 'Jumlah TPS tidak valid' }); return; }

    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const allCandidates = [
      { id: 'party', number: 0, name: null },
      ...candidates.map((c) => ({ id: c.id, number: Number(c.number), name: c.name.trim() })),
    ];

    const totalsPayload = allCandidates.map((c) => ({
      kelurahan_id: kelurahanId,
      party_name: 'Partai Keadilan Sejahtera',
      candidate_number: c.number,
      candidate_name: c.name,
      total_suara: columnTotals[c.id] || 0,
      source_file_name: null,
      sheet_info: null,
      election_year: electionYear,
      updated_by: authData?.user?.id || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('pemilih_suara_caleg').upsert(totalsPayload, { onConflict: 'kelurahan_id,candidate_number,election_year' });
    if (error) {
      setSaving(false);
      toast({ variant: 'destructive', title: 'Gagal menyimpan total', description: error.message });
      return;
    }

    const tpsPayload = [];
    allCandidates.forEach((c) => {
      tpsNumbers.forEach((tps) => {
        tpsPayload.push({
          kelurahan_id: kelurahanId,
          tps_number: tps,
          candidate_number: c.number,
          candidate_name: c.name,
          votes: Number(votes[`${c.id}::${tps}`]) || 0,
          election_year: electionYear,
        });
      });
    });
    for (let i = 0; i < tpsPayload.length; i += 500) {
      const { error: tpsError } = await supabase
        .from('pemilih_suara_caleg_tps')
        .upsert(tpsPayload.slice(i, i + 500), { onConflict: 'kelurahan_id,tps_number,candidate_number,election_year' });
      if (tpsError) {
        setSaving(false);
        toast({ variant: 'destructive', title: 'Total tersimpan, tapi rincian per TPS gagal', description: tpsError.message });
        onSaved();
        return;
      }
    }

    setSaving(false);
    toast({ title: 'Data tersimpan', description: `${candidates.length} caleg × ${jumlahTps} TPS untuk ${selectedKelurahanName} tersimpan.` });
    onSaved();
  };

  return (
    <div>
      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="p-label">Kelurahan</label>
            <PemilihSelect
              value={kelurahanId}
              onChange={setKelurahanId}
              options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
              placeholder="Pilih Kelurahan"
              title="Pilih Kelurahan"
            />
          </div>
          <div style={{ width: 140 }}>
            <label className="p-label">Tahun Pemilu</label>
            <PemilihSelect
              value={String(electionYear)}
              onChange={(v) => setElectionYear(Number(v))}
              options={[2019, 2024].map((y) => ({ value: String(y), label: String(y) }))}
              title="Pilih Tahun"
            />
          </div>
          <div style={{ width: 140 }}>
            <label className="p-label">Jumlah TPS</label>
            <input
              type="number" className="p-input" min={1} max={200}
              value={jumlahTps}
              onChange={(e) => setJumlahTps(Math.max(1, Number(e.target.value) || 1))}
              disabled={loadingExisting}
            />
          </div>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 11.5, color: '#9ca3af' }}>
          Tentukan jumlah TPS di kelurahan ini, lalu isi jumlah suara tiap caleg per TPS di tabel bawah. Data ini langsung tersimpan sebagai rincian per TPS — tidak perlu upload PDF.
        </p>
      </div>

      <div className="p-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <CardHeader title="Daftar Caleg" subtitle="Nomor urut & nama caleg PKS yang suaranya akan diinput" icon={Users} iconColor="#2563eb" iconBg="#eff6ff" />
          <button className="p-btn-ghost" onClick={addCandidate} style={{ flexShrink: 0 }}>
            <Plus size={14} /> Tambah Caleg
          </button>
        </div>
        {candidates.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Belum ada caleg. Klik "Tambah Caleg" untuk mulai.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number" className="p-input" style={{ width: 80 }} min={1}
                  value={c.number}
                  onChange={(e) => updateCandidate(c.id, 'number', e.target.value)}
                  placeholder="No."
                />
                <input
                  type="text" className="p-input" style={{ flex: 1 }}
                  value={c.name}
                  onChange={(e) => updateCandidate(c.id, 'name', e.target.value)}
                  placeholder="Nama caleg"
                />
                <button onClick={() => removeCandidate(c.id)} style={{ color: '#dc2626', padding: 6, flexShrink: 0 }} title="Hapus caleg">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <CardHeader
            title={`Suara per TPS — ${selectedKelurahanName || '...'}`}
            subtitle={`${tpsNumbers.length} TPS × ${candidates.length} caleg`}
            icon={Table2} iconColor="#ea580c" iconBg="#fff7ed"
          />
          <button className="p-btn-primary" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', flexShrink: 0 }} onClick={handleSave} disabled={saving || loadingExisting || !kelurahanId}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
          </button>
        </div>

        {loadingExisting ? (
          <div style={{ padding: 50, textAlign: 'center' }}><Loader2 className="animate-spin" size={26} color="#ea580c" /></div>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>TPS</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Partai</th>
                  {candidates.map((c) => (
                    <th key={c.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }} title={c.name}>
                      {c.number}. {c.name || '(tanpa nama)'}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {tpsNumbers.map((tps) => (
                  <tr key={tps}>
                    <td style={{ fontWeight: 700 }}>{String(tps).padStart(2, '0')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number" className="p-input" style={{ width: 72, textAlign: 'right' }} min={0}
                        value={votes[`party::${tps}`] ?? ''}
                        onChange={(e) => setVote('party', tps, e.target.value)}
                      />
                    </td>
                    {candidates.map((c) => (
                      <td key={c.id} style={{ textAlign: 'center' }}>
                        <input
                          type="number" className="p-input" style={{ width: 72, textAlign: 'right' }} min={0}
                          value={votes[`${c.id}::${tps}`] ?? ''}
                          onChange={(e) => setVote(c.id, tps, e.target.value)}
                        />
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{rowTotals[tps].toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{(columnTotals.party || 0).toLocaleString('id-ID')}</td>
                  {candidates.map((c) => (
                    <td key={c.id} style={{ textAlign: 'center', fontWeight: 800 }}>{(columnTotals[c.id] || 0).toLocaleString('id-ID')}</td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{grandTotal.toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin: '10px 0 0', fontSize: 10.5, color: '#9ca3af' }}>
          Kolom "Partai" adalah suara partai tanpa calon. Kosongkan sel kalau tidak ada suara — akan tersimpan sebagai 0.
        </p>
      </div>
    </div>
  );
};

export default PemilihSuaraPks;
