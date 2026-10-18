import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Home, TrendingUp, PlayCircle, ClipboardList, MessageCircle, Send, Check, Play, CalendarPlus, CalendarCheck, ChevronLeft, Activity, Ban, AlertTriangle, Flame, Snowflake, Lock } from 'lucide-react';
import { formatOnsetAgo } from '@/lib/onsetHelpers';
import { portalApi, loadSession, saveSession, clearSession, loadDraft, saveDraft } from '@/lib/patientPortal';
import './portal.css';

// Aplikasi pasien Clinara, dibuka dari tautan /p/<token> yang dikirim admin.
// Tanpa login: pasien memasukkan tanggal lahir (portal_verify), sesinya
// disimpan di perangkat sampai admin menonaktifkan tautan.
// Skema dan RPC: supabase/manual/9_portal_pasien_clinara.sql

const TABS = [
  ['home', 'Beranda', Home], ['prog', 'Progres', TrendingUp], ['lat', 'Latihan', PlayCircle],
  ['fb', 'Keluhan', ClipboardList], ['chat', 'Chat', MessageCircle],
];
const DAYS = ['S', 'S', 'R', 'K', 'J', 'S', 'M'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const TAGS = ['Nyeri saat berjalan', 'Kaku pagi hari', 'Bengkak', 'Nyeri naik tangga', 'Terasa lemah', 'Sulit tidur'];

const fmtDate = (d, opts = { day: 'numeric', month: 'short' }) =>
  new Date(d).toLocaleDateString('id-ID', opts);
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};
const TOP_PAD = 'calc(env(safe-area-inset-top, 0px) + 28px)';
const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
// Nama terapis tanpa gelar ("Adi Pratama,S.Fis.,Ftr" -> "Adi Pratama").
const shortName = (n) => String(n || '').split(',')[0].trim();
const dotTime = (t) => String(t || '').replace(':', '.');
const dayOf = (iso) => new Date(`${iso}T00:00:00`);
// Langkah latihan: per baris, atau per kalimat bila teksnya beberapa kalimat. Satu kalimat tampil sebagai paragraf.
const toSteps = (t) => {
  const lines = String(t || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : String(t || '').split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts.map((x) => x.replace(/^\d+[.)]\s*/, '')) : null;
};
const initials = (n) => (n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const daysUntil = (d) => {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const n = Math.round((b - a) / 86400000);
  return n <= 0 ? 'hari ini' : n === 1 ? 'besok' : `${n} hari lagi`;
};

// State yang ikut tersimpan di perangkat (per tautan), jadi tidak hilang saat refresh.
const useDraft = (token, name, initial) => {
  const [value, setValue] = useState(() => loadDraft(token, name, initial));
  useEffect(() => { saveDraft(token, name, value); }, [token, name, value]);
  return [value, setValue];
};

// Peta pemulihan: empat fase, ditentukan dari rata-rata progres target terapi yang diisi terapis.
const PHASES = [
  ['Redakan nyeri', 'Nyeri berkurang dan gerak terasa aman'],
  ['Pulihkan gerak', 'Gerak sehari-hari kembali lancar'],
  ['Bangun kekuatan', 'Otot penopang dikuatkan untuk aktivitas lebih berat'],
  ['Kembali aktif', 'Target utama tercapai, kembali beraktivitas penuh'],
];
const PHASE_CUTS = [0, 25, 50, 80, 100];
const journeyOf = (goals) => {
  if (!goals?.length) return null;
  const avg = goals.reduce((a, g) => a + (g.progress || 0), 0) / goals.length;
  if (avg >= 100) return { idx: 3, pct: 100, done: true };
  const idx = Math.min(3, PHASE_CUTS.findIndex((c, k) => avg < PHASE_CUTS[k + 1]));
  const pct = Math.round(((avg - PHASE_CUTS[idx]) / (PHASE_CUTS[idx + 1] - PHASE_CUTS[idx])) * 100);
  return { idx, pct, done: false };
};

const Mark = ({ clinic }) => (
  <span className="mark">{clinic?.logo_url ? <img src={clinic.logo_url} alt="" /> : (clinic?.name || clinic?.clinic_name || 'C')[0]}</span>
);

const Topo = () => (
  <svg className="topo" viewBox="0 0 200 200" aria-hidden="true">
    <path d="M20 100c20-40 60-60 100-40s60 70 40 90-70 20-100 0-60-20-40-50z" />
    <path d="M40 100c15-28 45-42 75-28s42 50 28 64-50 15-72 0-45-14-31-36z" />
    <path d="M60 100c10-16 28-24 46-16s26 30 16 38-30 9-43 0-27-8-19-22z" />
  </svg>
);

// ---------------------------------------------------------------- Gate
const REASONS = {
  invalid: 'Tautan ini tidak dikenali. Minta tautan baru ke klinik Anda.',
  locked: 'Tautan terkunci karena terlalu banyak salah tanggal lahir. Hubungi klinik untuk membukanya.',
  disabled: 'Akses ke tautan ini sedang dinonaktifkan oleh klinik. Hubungi klinik jika perlu.',
  expired: 'Tautan ini sudah kedaluwarsa. Minta tautan baru ke klinik Anda.',
};

const Gate = ({ branding, onVerify, notice }) => {
  const [v, setV] = useState({ d: '', m: '', y: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = [useRef(), useRef(), useRef()];

  const set = (key, max, idx) => (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, max);
    setV((p) => ({ ...p, [key]: val }));
    if (val.length === max && refs[idx + 1]) refs[idx + 1].current.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (v.y.length !== 4 || !v.m || !v.d) { setErr('Isi tanggal, bulan, dan tahun lahir.'); return; }
    setBusy(true); setErr('');
    const res = await onVerify(`${v.y}-${v.m.padStart(2, '0')}-${v.d.padStart(2, '0')}`);
    setBusy(false);
    if (res && !res.ok) {
      if (res.reason === 'mismatch') setErr(`Tanggal lahir tidak cocok. Sisa percobaan: ${res.remaining}.`);
      else setErr(REASONS[res.reason] || 'Tidak bisa masuk. Coba lagi.');
    }
  };

  return (
    <div className="gate">
      <Topo />
      <div className="logo"><Mark clinic={branding} />{branding.clinic_name}</div>
      <h1>Pemulihan Anda punya peta.</h1>
      <p className="lead">Lihat fase pemulihan Anda, target yang sedang dikejar, dan latihan hari ini, langsung dari terapis Anda.</p>
      <ul className="gate-points">
        {['Fase dan target terapi yang jelas', 'Grafik nyeri dari sesi ke sesi', 'Chat langsung dengan terapis'].map((t) => (
          <li key={t}><i><Check size={16} strokeWidth={2.6} aria-hidden="true" /></i>{t}</li>
        ))}
      </ul>
      {notice && <p className="notice">{notice}</p>}
      <form className="panel" onSubmit={submit} autoComplete="off">
        <b className="gate-label">Masukkan tanggal lahir Anda</b>
        <div className="dob">
          <label htmlFor="pp-dd">Hari<input id="pp-dd" ref={refs[0]} inputMode="numeric" placeholder="HH" value={v.d} onChange={set('d', 2, 0)} /></label>
          <label htmlFor="pp-mm">Bulan<input id="pp-mm" ref={refs[1]} inputMode="numeric" placeholder="BB" value={v.m} onChange={set('m', 2, 1)} /></label>
          <label htmlFor="pp-yy">Tahun<input id="pp-yy" ref={refs[2]} inputMode="numeric" placeholder="TTTT" value={v.y} onChange={set('y', 4, 2)} /></label>
        </div>
        <p className="err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Memeriksa...' : 'Masuk ke portal'}</button>
        <p className="safe"><Lock size={16} aria-hidden="true" />Hanya Anda yang bisa membuka halaman ini</p>
        <p className="powered" style={{ marginTop: 6 }}>Didukung Clinara</p>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------- Chart
const VasChart = ({ entries }) => {
  const pts = entries.filter((e) => e.vas != null);
  if (pts.length < 2) return <p className="muted" style={{ margin: '14px 0 0' }}>Grafik muncul setelah dua sesi tercatat.</p>;
  const W = 330, H = 150;
  const x = (i) => 30 + (i * (W - 50)) / (pts.length - 1);
  const y = (n) => 10 + ((10 - n) * (H - 30)) / 10;
  const xy = pts.map((p, i) => [x(i), y(p.vas)]);
  const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const last = xy[xy.length - 1];
  // Label tanggal: awal, akhir, dan beberapa di tengah supaya tidak bertumpuk.
  const every = Math.ceil(pts.length / 4);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 16}`} width="100%" role="img" aria-label={`Nyeri dari ${pts[0].vas} menjadi ${pts[pts.length - 1].vas} dari 10`}>
      {[0, 5, 10].map((n) => (
        <g key={n}><line className="g" x1="18" x2={W - 8} y1={y(n)} y2={y(n)} /><text x={n === 10 ? 0 : 4} y={y(n) + 4}>{n}</text></g>
      ))}
      <path className="a" d={`${path} L${last[0]} ${y(0)} L${xy[0][0]} ${y(0)}Z`} />
      <path className="l" d={path} />
      {xy.map((p, i) => (
        <g key={i}>
          <circle className={i === xy.length - 1 ? 'pl' : 'p'} cx={p[0]} cy={p[1]} r={i === xy.length - 1 ? 7 : 4} />
          {(i === 0 || i === xy.length - 1 || (i % every === 0 && i < xy.length - every / 2)) && (
            <text x={p[0]} y={H + 14} textAnchor="middle">{fmtDate(pts[i].date, { day: 'numeric', month: 'numeric' })}</text>
          )}
        </g>
      ))}
      <text className="tb" x={xy[0][0]} y={xy[0][1] - 12} textAnchor="middle">{pts[0].vas}</text>
      <text className="tb" x={last[0]} y={last[1] - 14} textAnchor="middle">{pts[pts.length - 1].vas}</text>
    </svg>
  );
};

// ---------------------------------------------------------------- Tabs
const Journey = ({ goals }) => {
  const j = journeyOf(goals);
  if (!j) return null;
  return (
    <div className="jr">
      <div className="jr-head"><b>Peta pemulihan Anda</b><span>Fase {j.idx + 1} dari 4</span></div>
      <div className="jr-line">
        <span className="jr-fill" style={{ width: `${(j.idx / 3) * 76}%` }} />
        {PHASES.map(([name], i) => {
          const state = j.done || i < j.idx ? 'done' : i === j.idx ? 'now' : '';
          return (
            <div key={name} className={`st ${state}`}>
              <span className="d">{state === 'done' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : state === 'now' ? <i /> : null}</span>
              {name}
            </div>
          );
        })}
      </div>
      <div className="jr-foot">
        {j.done ? <span>Semua target tercapai</span> : <><span>Fase ini <b className="num">{j.pct}%</b></span><span>{PHASES[j.idx][1]}</span></>}
      </div>
    </div>
  );
};

// Goal treatment dari terapis: bilah progres per goal.
const GoalsCard = ({ goals }) => {
  if (!goals?.length) return null;
  return (
    <section className="card">
      <div className="row"><h3 className="sp">Target terapi</h3><span className="muted small">{goals.length} target</span></div>
      {goals.map((g) => (
        <div key={g.id} className="goal">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <b className="sp goal-text">{g.text}</b>
            {g.progress >= 100 ? <span className="pill ok">Tercapai</span> : <span className="num goal-pct">{g.progress}%</span>}
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.progress} aria-label={g.text}><i style={{ width: `${g.progress}%` }} /></div>
        </div>
      ))}
    </section>
  );
};

const HomeTab = ({ home, goals, go, onLogout }) => {
  const na = home.next_appointment;
  const pct = home.program_total ? Math.round((home.program_done_today / home.program_total) * 100) : 0;
  const left = home.program_total - home.program_done_today;
  return (
    <>
      <header className="top">
        <Topo />
        <div className="top-in">
          <div className="row">
            <div className="avatar">{initials(home.first_name)}</div>
            <div className="sp"><b className="clinic-name">{home.clinic?.name}</b>
              <div className="top-date">{fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
            {home.sessions_done > 0 ? <span className="pill warm num">Sesi ke-{home.sessions_done}</span> : null}
          </div>
          <div>
            <h1>{greeting()}, {home.first_name}</h1>
            {(home.complaint || home.therapist) && (
              <p className="hero-sub">{[home.complaint, home.therapist && `bersama ${shortName(home.therapist)}`].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <Journey goals={goals} />
        </div>
      </header>
      <div className="pp-pad">
        <div className="pair eq">
          {na ? (
            <section className="card">
              <div className="row" style={{ gap: 14 }}>
                <div className="date-box"><small>{MONTHS[new Date(na.appointment_date).getMonth()]}</small><b className="num">{new Date(na.appointment_date).getDate()}</b></div>
                <div className="sp">
                  <h3>Sesi berikutnya</h3>
                  <div className="next-when">{fmtDate(na.appointment_date, { weekday: 'long' })}, {fmtTime(na.appointment_date)}</div>
                  <div className="muted small">{[na.therapist && shortName(na.therapist), daysUntil(na.appointment_date)].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
              <button className="btn ghost" onClick={() => go('book')}><CalendarPlus size={20} aria-hidden="true" />Atur jadwal lain</button>
            </section>
          ) : (
            <section className="card">
              <h3>Belum ada jadwal sesi</h3>
              <p className="muted" style={{ margin: '6px 0 16px' }}>Pilih hari dan jam terapi berikutnya.</p>
              <button className="btn" onClick={() => go('book')}><CalendarPlus size={20} aria-hidden="true" />Booking jadwal</button>
            </section>
          )}
          {home.program_total > 0 && (
            <section className="card">
              <div className="row" style={{ alignItems: 'baseline' }}>
                <h3 className="sp">Latihan hari ini</h3>
                <span className="num prog-count"><b>{home.program_done_today}</b>/{home.program_total}</span>
              </div>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Latihan selesai hari ini"><i style={{ width: `${pct}%` }} /></div>
              <div className="muted small">{left === 0 ? 'Semua selesai hari ini. Kerja bagus.' : `Sisa ${left} latihan.`}</div>
              <div className="week">
                {(home.week || []).map((d, i) => (
                  <div key={d.date} className={`${d.done ? 'done' : ''} ${d.today ? 'today' : ''}`}>{DAYS[i]}<i><Check size={15} strokeWidth={3} /></i></div>
                ))}
              </div>
              <button className="btn" onClick={() => go('lat')}>{left === 0 ? 'Lihat latihan' : 'Lanjut latihan'}</button>
            </section>
          )}
        </div>
        <div className="stat3">
          <div><b className="num" style={{ color: 'var(--ok)' }}>{home.vas_latest != null ? <>{home.vas_latest}<small>/10</small></> : '–'}</b><span>{home.vas_latest != null ? `Nyeri${home.vas_first != null && home.vas_first !== home.vas_latest ? `, awal ${home.vas_first}` : ''}` : 'Nyeri belum tercatat'}</span></div>
          <div><b className="num">{home.streak_days} hari</b><span>Latihan beruntun</span></div>
          <div><b className="num">{home.sessions_done}</b><span>Sesi selesai</span></div>
        </div>
        <div className="pair">
          <GoalsCard goals={goals} />
          {home.latest_note && (
            <section className="quote">
              <h3>Catatan dari terapis</h3>
              <p>“{home.latest_note}”</p>
              {home.therapist && <div className="by"><span className="mini">{initials(shortName(home.therapist))}</span>{shortName(home.therapist)}</div>}
            </section>
          )}
        </div>
        {home.latest_education && (
          <EduCard text={home.latest_education} />
        )}
        <div className="powered">Didukung Clinara · {home.clinic?.name}</div>
        <button className="btn ghost logout" onClick={onLogout}>Keluar dari perangkat ini</button>
      </div>
    </>
  );
};

// Edukasi terapis tersimpan sebagai teks bebas dengan satu poin per baris ("- ...").
// Dipecah ke kelompok Lakukan / Hindari / Kompres / Waspada lewat kata awal tiap poin.
const BULLET = /^\s*[-•*]\s+/;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const parseEducation = (text) => {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.some((l) => BULLET.test(l))) return null;
  const g = { do: [], avoid: [], warn: [], compress: null };
  lines.forEach((raw) => {
    const l = raw.replace(BULLET, '');
    if (/^(informasikan|segera|hubungi)\b/i.test(l) || /kesemutan|kelemahan/i.test(l)) g.warn.push(l);
    else if (/^hindari\b/i.test(l)) g.avoid.push(l);
    else if (/kompres/i.test(l)) {
      const [hot, cold] = l.split(/,?\s*(?:dan\s+)?(?=kompres\s+dingin)/i);
      g.compress = cold && /hangat/i.test(hot)
        ? { hot: cap(hot.replace(/[,\s]+$/, '')), cold: cap(cold) }
        : { plain: l };
    } else g.do.push(l);
  });
  return g;
};

const EduCard = ({ text }) => {
  const [kind, setKind] = useState('hot');
  const g = parseEducation(text);
  if (!g) {
    return (
      <section className="card edu">
        <h3>Panduan di rumah</h3>
        <p className="edu-text">{text}</p>
      </section>
    );
  }
  const c = g.compress;
  return (
    <section className="card edu">
      <h3>Panduan di rumah</h3>
      {g.do.length > 0 && (
        <div className="edu-sec">
          <h4 className="ok">Lakukan</h4>
          {g.do.map((t, i) => <div className="edu-item ok" key={i}><span className="edu-tile"><Check size={18} strokeWidth={2.4} /></span><p>{cap(t)}</p></div>)}
        </div>
      )}
      {g.avoid.length > 0 && (
        <div className="edu-sec">
          <h4 className="warm">Hindari</h4>
          {g.avoid.map((t, i) => <div className="edu-item warm" key={i}><span className="edu-tile"><Ban size={18} strokeWidth={2.2} /></span><p>{cap(t)}</p></div>)}
        </div>
      )}
      {c && (
        <div className="edu-sec">
          <h4 className="brand">{c.plain ? 'Kompres' : 'Kompres, sesuai kondisi'}</h4>
          {c.plain ? (
            <div className="edu-item"><span className="edu-tile"><Flame size={18} /></span><p>{cap(c.plain)}</p></div>
          ) : (
            <>
              <div className="edu-seg" role="group" aria-label="Pilih kondisi kompres">
                <button className={kind === 'hot' ? 'on' : ''} aria-pressed={kind === 'hot'} onClick={() => setKind('hot')}><Flame size={18} />Terasa kaku</button>
                <button className={kind === 'cold' ? 'on' : ''} aria-pressed={kind === 'cold'} onClick={() => setKind('cold')}><Snowflake size={18} />Nyeri naik</button>
              </div>
              <p className="edu-tip">{kind === 'hot' ? c.hot : c.cold}</p>
            </>
          )}
        </div>
      )}
      {g.warn.length > 0 && (
        <div className="edu-warn" role="note">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><b>Hubungi terapis segera</b>{g.warn.map((t, i) => <p key={i}>{cap(t)}</p>)}</div>
        </div>
      )}
    </section>
  );
};

const PageHead = ({ title, sub }) => (
  <div className="page-head"><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div>
);

// Fase pemulihan dalam bentuk linimasa, fase berjalan diberi bilah progres.
const PhaseTimeline = ({ goals }) => {
  const j = journeyOf(goals);
  if (!j) return null;
  return (
    <section className="card">
      <h3 style={{ marginBottom: 14 }}>Fase pemulihan</h3>
      <div className="phases">
        {PHASES.map(([name, desc], i) => {
          const state = j.done || i < j.idx ? 'done' : i === j.idx ? 'now' : '';
          return (
            <div key={name} className={`ph-it ${state}`}>
              <div className="row"><b className="sp">Fase {i + 1} · {name}</b>{state === 'now' && <span className="pill warm">Sekarang</span>}</div>
              <p>{desc}</p>
              {state === 'now' && <div className="bar warm" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={j.pct} aria-label={`Progres fase ${name}`}><i style={{ width: `${j.pct}%` }} /></div>}
            </div>
          );
        })}
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>Fase dihitung dari rata-rata progres target terapi yang dicatat terapis.</p>
    </section>
  );
};

// Target terapi: pilih satu target untuk melihat progresnya per sesi.
const GoalsDetail = ({ goals }) => {
  const [sel, setSel] = useState(0);
  if (!goals?.length) return null;
  const g = goals[Math.min(sel, goals.length - 1)];
  const hist = g.history || [];
  const prev = hist.length > 1 ? hist[hist.length - 2].progress : null;
  const gain = prev != null ? g.progress - prev : null;
  return (
    <section className="card">
      <h3>Target terapi</h3>
      <p className="muted small" style={{ margin: '2px 0 12px' }}>Ketuk target untuk melihat kemajuan per sesi</p>
      <div className="gsel">
        {goals.map((x, i) => (
          <button key={x.id} className={x.id === g.id ? 'on' : ''} aria-pressed={x.id === g.id} onClick={() => setSel(i)}>
            <span className="row"><b className="sp goal-text">{x.text}</b>{x.progress >= 100 ? <span className="pill ok">Tercapai</span> : <span className="num goal-pct">{x.progress}%</span>}</span>
            <span className="bar"><i style={{ width: `${x.progress}%` }} /></span>
          </button>
        ))}
      </div>
      {hist.length > 0 && (
        <div className="hist-bars" aria-label="Riwayat target terpilih">
          {hist.slice(-8).map((h, i, arr) => (
            <div key={`${h.date}-${i}`} className={i === arr.length - 1 ? 'last' : ''} style={{ height: `${Math.max(h.progress, 6)}%` }}>
              <span className="num">{h.progress}%</span>
            </div>
          ))}
        </div>
      )}
      <p className="small" style={{ marginTop: 10 }}>
        {gain > 0 ? <><b style={{ color: 'var(--ok)' }}>+{gain} poin</b> sejak sesi lalu. </> : null}
        {hist.length > 0 ? `Awal ${hist[0].progress}%, kini ${g.progress}%.` : `Kini ${g.progress}%.`}
      </p>
    </section>
  );
};

const SessionLog = ({ entries }) => {
  const list = entries.slice(-20);
  const [sel, setSel] = useState(list.length - 1);
  if (list.length === 0) return <section className="card"><h3>Riwayat sesi</h3><p className="muted" style={{ margin: '8px 0 0' }}>Belum ada sesi tercatat.</p></section>;
  const e = list[Math.min(sel, list.length - 1)];
  return (
    <section className="card">
      <h3 style={{ marginBottom: 10 }}>Riwayat sesi</h3>
      <div className="chips">
        {list.map((x, i) => (
          <button key={x.no} className="chip sm" aria-pressed={x.no === e.no} onClick={() => setSel(i)}>Sesi {x.no}</button>
        ))}
      </div>
      <div className="sess-note">
        <div className="row"><b className="sp">{fmtDate(e.date)} · Sesi {e.no}</b>{e.vas != null && <span className="pill num">Nyeri {e.vas}/10</span>}</div>
        <p className="small">{e.update ? cap(e.update) : 'Tidak ada catatan perkembangan untuk sesi ini.'}</p>
      </div>
    </section>
  );
};

const ProgressTab = ({ data, goals, complaint }) => {
  const entries = data.entries || [];
  const vasPts = entries.filter((e) => e.vas != null);
  const first = vasPts[0], last = vasPts[vasPts.length - 1];
  const history = data.history || [];
  const ep = history.find((h) => h.is_current);
  // Onset dari Subjective berupa perkiraan, jadi tampil sebagai durasi yang ikut bertambah ("sejak 3 minggu yang lalu").
  const since = ep?.onset_date
    ? `sejak ${ep.onset_exact ? fmtDate(ep.onset_date, { day: 'numeric', month: 'long', year: 'numeric' }) : formatOnsetAgo(ep.onset_date) || fmtDate(ep.onset_date)}`
    : entries.length ? `mulai terapi ${fmtDate(entries[0].date, { day: 'numeric', month: 'long' })}` : '';
  return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
      <PageHead title="Perjalanan Anda" sub={[ep?.label || complaint, since].filter(Boolean).join(', ')} />
      <div className="pair">
        <div className="stack">
          <PhaseTimeline goals={goals} />
          <section className="card">
            {vasPts.length ? (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="sp"><h3>Skala nyeri</h3>
                  <div className="vas-big"><b className="num">{last.vas}</b><span className="muted">/10 terakhir</span></div></div>
                {vasPts.length > 1 && first.vas > last.vas && <span className="pill ok">Turun {first.vas - last.vas} poin</span>}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>Nilai nyeri akan tampil setelah terapis mencatatnya saat sesi.</p>}
            <VasChart entries={entries} />
          </section>
        </div>
        <div className="stack">
          <GoalsDetail goals={goals} />
          <SessionLog entries={entries} />
        </div>
      </div>
      {history.length > 0 && (
        <section className="card">
          <h3 style={{ marginBottom: 4 }}>Riwayat diagnosa</h3>
          <p className="muted" style={{ margin: '0 0 16px' }}>Setiap diagnosa baru mencatat perkembangan dari awal.</p>
          <ul className="tl">
            {history.map((h) => (
              <li key={h.no}>
                <div>
                  <b>{h.label || 'Diagnosa belum dicatat'}</b>
                  <span className={`pill${h.is_current ? ' ok' : ''}`} style={{ marginLeft: 10 }}>{h.is_current ? 'Sedang berjalan' : 'Sebelumnya'}</span>
                  <p className="muted">
                    {fmtDate(h.started_on, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {h.ended_on !== h.started_on && ` – ${fmtDate(h.ended_on, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    {` · ${h.sessions} sesi`}
                    {h.vas_first != null && h.vas_last != null && ` · Nyeri ${h.vas_first}/10${h.sessions > 1 ? ` → ${h.vas_last}/10` : ''}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

// Tautan putar bertanda tangan (berlaku 1 jam) untuk semua latihan yang punya video, diambil dalam satu
// panggilan beserta gambar sampulnya. urls: null = gagal dimuat. posters: tautan JPG sampul atau null.
const useVideoUrls = (session, items) => {
  const [urls, setUrls] = useState({});
  const [posters, setPosters] = useState({});
  const asked = useRef(new Set());
  const load = useCallback((id, force = false) => {
    if (!force && asked.current.has(id)) return;
    asked.current.add(id);
    portalApi.videoUrl(session, id)
      .then((u) => setUrls((p) => ({ ...p, [id]: u })))
      .catch(() => setUrls((p) => ({ ...p, [id]: null })));
  }, [session]);
  useEffect(() => {
    const ids = items.filter((i) => i.has_video && !asked.current.has(i.exercise_id)).map((i) => i.exercise_id);
    if (ids.length === 0) return;
    ids.forEach((id) => asked.current.add(id));
    portalApi.videoUrls(session, ids)
      .then((res) => {
        setUrls((p) => ({ ...p, ...Object.fromEntries(ids.map((id) => [id, res[id]?.url ?? null])) }));
        setPosters((p) => ({ ...p, ...Object.fromEntries(ids.map((id) => [id, res[id]?.poster ?? null])) }));
      })
      // Fungsi lama tanpa mode daftar: ambil satu per satu seperti sebelumnya.
      .catch(() => ids.forEach((id) => load(id, true)));
  }, [items, session, load]);
  return [urls, load, posters];
};

const markReady = (e) => e.currentTarget.classList.add('ready');

const Thumb = ({ item, url, poster }) => (
  <span className={`thumb${item.has_video ? '' : ' no-video'}`} aria-hidden="true">
    {item.has_video && (poster
      ? <img src={poster} alt="" decoding="async" onLoad={markReady} />
      // Belum ada sampul: ambil satu bingkai dari videonya (lebih lambat).
      : poster === null && url && <video src={`${url}#t=0.5`} muted playsInline preload="metadata" tabIndex={-1} onLoadedData={markReady} />)}
    {item.has_video ? <span className="play"><Play size={16} fill="currentColor" /></span> : <Activity size={26} strokeWidth={1.6} />}
  </span>
);

const RING = 2 * Math.PI * 34;

const ProgramTab = ({ session, items, therapist, onToggle }) => {
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [urls, loadUrl, posters] = useVideoUrls(session, items);
  const doneCount = items.filter((i) => i.done_today).length;
  const left = items.length - doneCount;
  const pct = items.length ? doneCount / items.length : 0;
  const toggle = async (e) => {
    setBusyId(e.exercise_id);
    await onToggle(e.exercise_id, !e.done_today);
    setBusyId(null);
  };

  return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
      <PageHead title="Program rumah" sub={therapist ? `Dari ${shortName(therapist)}. Berhenti jika nyeri lebih dari 5/10 dan kabari terapis.` : 'Berhenti jika nyeri lebih dari 5/10 dan kabari terapis.'} />
      {items.length === 0 && <div className="card muted">Terapis belum memberi latihan. Latihan akan tampil di sini setelah sesi berikutnya.</div>}
      {items.length > 0 && (
        <section className="card row ring-card">
          <svg className="ring" viewBox="0 0 84 84" role="img" aria-label={`${doneCount} dari ${items.length} latihan selesai`}>
            <circle className="bg" cx="42" cy="42" r="34" />
            <circle className="fg" cx="42" cy="42" r="34" style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - pct) }} />
            <text x="42" y="48" textAnchor="middle">{doneCount}/{items.length}</text>
          </svg>
          <div className="sp"><b className="ring-title">{left === 0 ? 'Program hari ini tuntas' : `${left} latihan lagi`}</b>
            <p className="muted small">Lakukan 1× sehari. Ketuk bulatan setelah selesai, ketuk nama latihan untuk cara melakukannya.</p></div>
        </section>
      )}
      <div className="ex-grid">
        {items.map((e) => {
          const open = openId === e.exercise_id;
          const url = urls[e.exercise_id];
          const steps = toSteps(e.how_to);
          return (
            <div className={`ex${e.done_today ? ' is-done' : ''}`} key={e.exercise_id}>
              <div className="ex-r">
                <button className="ex-open" onClick={() => setOpenId(open ? null : e.exercise_id)} aria-expanded={open}>
                  <Thumb item={e} url={url} poster={posters[e.exercise_id]} />
                  <span className="sp"><b className="ex-title">{e.title}</b><span className="muted small">{e.dose}</span></span>
                </button>
                <button className={`ck${e.done_today ? ' on' : ''}`} onClick={() => toggle(e)} disabled={busyId === e.exercise_id} aria-pressed={!!e.done_today} aria-label={`Tandai ${e.title} selesai`}>
                  <Check size={22} strokeWidth={3} />
                </button>
              </div>
              {open && (
                <div className="ex-d">
                  {e.has_video && (
                    <div className="player">
                      {url ? <video key={url} src={url} controls playsInline preload="metadata" onError={() => loadUrl(e.exercise_id, true)} />
                        : url === null ? <span>Video belum bisa diputar. Ikuti langkah di bawah ini.</span>
                        : <span>Memuat video...</span>}
                    </div>
                  )}
                  {e.how_to && (steps ? <ol className="steps">{steps.map((x, i) => <li key={i}>{x}</li>)}</ol> : <p>{e.how_to}</p>)}
                  {e.progression && <><div className="k ok">Jika sudah terasa ringan</div><p>{e.progression}</p></>}
                  {e.caution && <><div className="k warm">Perhatian</div><p>{e.caution}</p></>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PAIN_WORDS = ['Tidak nyeri', 'Sangat ringan', 'Ringan', 'Ringan', 'Sedang', 'Sedang', 'Cukup berat', 'Berat', 'Berat', 'Sangat berat', 'Tak tertahankan'];
const painTone = (v) => (v <= 3 ? 'lo' : v <= 6 ? 'md' : 'hi');

const FeedbackTab = ({ token, history, onSubmit }) => {
  const [draft, setDraft] = useDraft(token, 'draft-feedback', { vas: null, tags: [], msg: '' });
  const { vas = null, tags = [], msg = '' } = draft || {};
  const setVas = (v) => setDraft((d) => ({ ...d, vas: v }));
  const setTags = (fn) => setDraft((d) => ({ ...d, tags: fn(d?.tags || []) }));
  const setMsg = (m) => setDraft((d) => ({ ...d, msg: m }));
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (vas == null) return;
    setBusy(true);
    const ok = await onSubmit(vas, tags, msg.trim());
    setBusy(false);
    if (ok) { setDraft({ vas: null, tags: [], msg: '' }); setSent(true); }
  };
  return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
      <PageHead title="Bagaimana kondisi Anda hari ini?" sub="Laporan Anda dibaca terapis sebelum sesi berikutnya." />
      <div className="pair">
        {sent ? (
          <section className="card ok-card">
            <span className="done-mark"><Check size={30} strokeWidth={2.6} aria-hidden="true" /></span>
            <h3>Laporan terkirim</h3>
            <p className="muted">Terapis akan membacanya sebelum sesi berikutnya. Bila nyeri memburuk, kabari lewat Chat.</p>
            <button className="btn ghost" onClick={() => setSent(false)}>Kirim laporan lain</button>
          </section>
        ) : (
          <form className="card form" onSubmit={submit}>
            <div className="field">
              <label id="pp-vas-l">Seberapa nyeri saat ini?</label>
              <div className="vas-big" aria-live="polite"><b className="num">{vas == null ? '–' : vas}</b><span className="muted">{vas == null ? 'Pilih angka di bawah' : PAIN_WORDS[vas]}</span></div>
              <div className="scale" role="group" aria-labelledby="pp-vas-l">
                {PAIN_WORDS.map((w, n) => (
                  <button type="button" key={n} className={vas === n ? `on ${painTone(n)}` : ''} aria-pressed={vas === n} aria-label={`${n}, ${w}`} onClick={() => setVas(n)}>{n}</button>
                ))}
              </div>
              <div className="scale-k"><span>Tidak nyeri</span><span>Tak tertahankan</span></div>
            </div>
            <div className="field"><label>Yang Anda rasakan</label>
              <div className="chips">{TAGS.map((t) => (
                <button type="button" key={t} className="chip" aria-pressed={tags.includes(t)} onClick={() => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</button>
              ))}</div></div>
            <div className="field"><label htmlFor="pp-msg">Cerita singkat (opsional)</label>
              <textarea id="pp-msg" maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Misalnya: nyeri muncul setelah menyetir 1 jam." /></div>
            <button className="btn" type="submit" disabled={busy || vas == null}>{busy ? 'Mengirim...' : 'Kirim ke terapis'}</button>
          </form>
        )}
        <section className="card"><h3>Riwayat laporan</h3>
          {history.length === 0 && <p className="muted" style={{ margin: '10px 0 0' }}>Belum ada laporan.</p>}
          {history.map((f) => (
            <div className="hist" key={f.at}>
              <div className="row"><b className="sp">{fmtDate(f.at)}</b><span className={`pill num${f.vas >= 4 ? ' warm' : ''}`}>Nyeri {f.vas}/10</span></div>
              <p className="muted" style={{ margin: '6px 0 0' }}>{[(f.tags || []).join(', '), f.message].filter(Boolean).join('. ') || 'Tanpa catatan.'}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

// Booking jadwal terapi. Terapis yang terakhir menangani pasien dipilih lebih dulu; bila jadwalnya penuh
// di tanggal itu, terapis lain yang masih punya slot ditawarkan.
const BookingTab = ({ token, session, onBack, onBooked, onUnauthorized }) => {
  const [opts, setOpts] = useState(null);
  const [slots, setSlots] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tid, setTid] = useState(null);
  const [date, setDate] = useState(null);
  const [pick, setPick] = useState(null); // jam mulai
  const [note, setNote] = useDraft(token, 'draft-booking-note', '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [o, sl] = await Promise.all([portalApi.bookingOptions(session), portalApi.bookingSlots(session, 14)]);
      setOpts(o); setSlots(sl);
      const has = (id) => sl.some((x) => x.therapist_id === id);
      const lastId = o.last_therapist_id;
      const first = (o.therapists || []).find((t) => has(t.id));
      const id = lastId && has(lastId) ? lastId : first?.id || lastId || null;
      setTid((cur) => cur || id);
      const dates = [...new Set(sl.filter((x) => x.therapist_id === id).map((x) => x.date))].sort();
      setDate((cur) => cur || dates[0] || null);
    } catch (e) {
      if (e.sessionInvalid) onUnauthorized(); else setLoadError('Jadwal belum bisa dimuat. Periksa koneksi lalu coba lagi.');
    }
  }, [session, onUnauthorized]);
  useEffect(() => { load(); }, [load]);

  const top = (
    <div className="bk-top">
      <button className="back" onClick={onBack} aria-label="Kembali"><ChevronLeft size={22} aria-hidden="true" /></button>
      <h2>Booking jadwal</h2>
    </div>
  );

  if (done) {
    return (
      <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
        <section className="card ok-card">
          <span className="done-mark"><CalendarCheck size={30} strokeWidth={2} aria-hidden="true" /></span>
          <h2>Jadwal terbooking</h2>
          <p className="done-when">{fmtDate(done.appointment_date, { weekday: 'long', day: 'numeric', month: 'long' })}, {fmtTime(done.appointment_date)}</p>
          <p className="muted">Bersama {shortName(done.therapist)}. Klinik menerima pemberitahuan booking Anda.</p>
          <button className="btn" onClick={onBooked}>Kembali ke beranda</button>
        </section>
      </div>
    );
  }
  if (loadError) return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>{top}
      <section className="card"><p style={{ margin: '0 0 14px' }} role="alert">{loadError}</p><button className="btn" onClick={load}>Coba lagi</button></section>
    </div>
  );
  if (!opts || !slots) return <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>{top}<p className="muted">Memuat jadwal...</p></div>;

  const lastId = opts.last_therapist_id;
  const therapists = [...(opts.therapists || [])].sort((a, b) => (b.id === lastId) - (a.id === lastId));
  const dates = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toLocaleDateString('sv-SE'); });
  const mine = slots.filter((x) => x.therapist_id === tid);
  const countOn = (d) => mine.filter((x) => x.date === d).length;
  const onDay = mine.filter((x) => x.date === date);
  const tName = (id) => shortName(therapists.find((t) => t.id === id)?.name);
  const othersOnDay = therapists.filter((t) => t.id !== tid && slots.some((x) => x.date === date && x.therapist_id === t.id));
  const nextDate = onDay.length === 0 ? dates.find((d) => d > (date || '') && countOn(d) > 0) : null;

  const chooseT = (id) => {
    setTid(id); setPick(null); setError('');
    if (!slots.some((x) => x.date === date && x.therapist_id === id)) {
      setDate([...new Set(slots.filter((x) => x.therapist_id === id).map((x) => x.date))].sort()[0] || date);
    }
  };
  const confirm = async () => {
    setBusy(true); setError('');
    try {
      setDone(await portalApi.book(session, tid, date, pick, note.trim()));
      setNote('');
    } catch (e) {
      if (e.sessionInvalid) onUnauthorized();
      else { setError(e.message || 'Booking gagal. Coba lagi.'); setPick(null); load(); }
    }
    setBusy(false);
  };

  return (
    <div className="book">
      <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
        {top}
        {therapists.length > 0 && (
          <div>
            <b className="sec-label">Terapis</b>
            <div className="tsel">
              {therapists.map((t) => (
                <button key={t.id} className={t.id === tid ? 'on' : ''} aria-pressed={t.id === tid} onClick={() => chooseT(t.id)}>
                  <span className="avatar sm">{t.avatar_url ? <img src={t.avatar_url} alt="" /> : initials(shortName(t.name))}</span>
                  <span className="sp"><b>{shortName(t.name)}</b>
                    <span className="muted small">{t.id === lastId ? 'Terakhir menangani Anda' : t.specialization || 'Fisioterapis'}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <b className="sec-label">Tanggal</b>
          <div className="dstrip" role="group" aria-label="Pilih tanggal">
            {dates.map((d) => {
              const n = countOn(d); const dt = dayOf(d);
              return (
                <button key={d} className={`${date === d ? 'on' : ''}${n ? '' : ' none'}`} aria-pressed={date === d} onClick={() => { setDate(d); setPick(null); }}>
                  {d === dates[0] ? 'Hari ini' : WEEKDAYS[dt.getDay()]}<b className="num">{dt.getDate()}</b><i>{n ? `${n} slot` : 'Penuh'}</i>
                </button>
              );
            })}
          </div>
        </div>
        {!tid || !date ? (
          <section className="card"><h3>Belum ada jadwal kosong</h3><p className="muted" style={{ margin: '6px 0 0' }}>Semua slot dua minggu ke depan terisi. Hubungi klinik lewat Chat agar dicarikan jadwal.</p></section>
        ) : (
          <div>
            <div className="row" style={{ marginBottom: 10 }}><b className="sp">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</b><span className="muted small">{onDay.length ? `${onDay.length} jam tersedia` : 'Tidak ada jam'}</span></div>
            {onDay.length > 0 ? (
              <div className="slots">
                {onDay.map((x) => (
                  <button key={x.start} className="slot num" aria-pressed={pick === x.start} onClick={() => { setPick(x.start); setError(''); }}>{dotTime(x.start)}</button>
                ))}
              </div>
            ) : (
              <section className="card full-note">
                <p style={{ margin: 0 }}>Jadwal {tName(tid)} penuh di tanggal ini.</p>
                {nextDate && <button className="btn ghost" onClick={() => { setDate(nextDate); setPick(null); }}>Lihat {fmtDate(nextDate, { weekday: 'long', day: 'numeric', month: 'short' })}</button>}
                {othersOnDay.map((t) => <button key={t.id} className="btn ghost" onClick={() => chooseT(t.id)}>Lihat jadwal {shortName(t.name)}</button>)}
              </section>
            )}
          </div>
        )}
        {error && <p className="err" role="alert">{error}</p>}
      </div>
      {pick && (
        <div className="confirm-bar">
          <input className="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Catatan untuk terapis (opsional)" aria-label="Catatan untuk terapis" />
          <button className="btn warm" onClick={confirm} disabled={busy}>
            {busy ? 'Memproses...' : `Booking ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${dotTime(pick)}`}
          </button>
        </div>
      )}
    </div>
  );
};

const ChatTab = ({ token, session, therapist, clinicName, onUnauthorized }) => {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useDraft(token, 'draft-chat', '');
  const [error, setError] = useState('');
  const box = useRef();
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try {
      setMsgs(await portalApi.listMessages(session));
    } catch (e) { if (e.sessionInvalid) onUnauthorized(); }
  }, [session, onUnauthorized]);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (box.current && msgs.length !== lastCount.current) box.current.scrollTop = box.current.scrollHeight;
    lastCount.current = msgs.length;
  }, [msgs]);

  const send = async (e, quick) => {
    if (e) e.preventDefault();
    const body = (quick || text).trim();
    if (!body) return;
    setText(''); setError('');
    try { await portalApi.sendMessage(session, body); await load(); }
    catch (err) { if (err.sessionInvalid) onUnauthorized(); else { setError(err.message); setText(body); } }
  };

  return (
    <>
      <div className="chat-head">
        <span className="avatar brand">{initials(shortName(therapist || clinicName || '').replace(/^Ft\.?\s*/i, ''))}</span>
        <div className="sp"><b>{therapist ? shortName(therapist) : 'Terapis Anda'}</b><div className="muted small">Terapis Anda · balasan datang saat terapis bertugas</div></div>
      </div>
      <div className="msgs" ref={box}>
        {msgs.length === 0 ? <p className="muted" style={{ textAlign: 'center' }}>Belum ada pesan. Tulis pertanyaan Anda di bawah.</p> : <div className="day">Percakapan</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`m ${m.sender === 'patient' ? 'me' : 'them'}`}>{m.body}<small className="num">{fmtTime(m.at)}</small></div>
        ))}
      </div>
      {error && <p className="err" style={{ padding: '0 20px' }} role="alert">{error}</p>}
      <div className="qs">
        {['Nyeri bertambah', 'Tanya soal latihan', 'Minta ubah jadwal'].map((q) => <button key={q} type="button" onClick={() => send(null, q)}>{q}</button>)}
      </div>
      <form className="compose" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={therapist ? `Tulis pesan untuk ${shortName(therapist).split(' ')[0]}` : 'Tulis pesan'} aria-label="Pesan" maxLength={2000} />
        <button className="send" aria-label="Kirim"><Send size={22} /></button>
      </form>
    </>
  );
};

// ---------------------------------------------------------------- Page
const PatientPortalPage = () => {
  const { token } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | retry | blocked | gate | app
  const [branding, setBranding] = useState(null);
  const [blockedReason, setBlockedReason] = useState('invalid');
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useDraft(token, 'tab', 'home');
  const [home, setHome] = useState(null);
  const [progress, setProgress] = useState(null);
  const [goals, setGoals] = useState([]);
  const [program, setProgram] = useState([]);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState('');
  const [attempt, setAttempt] = useState(0);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const backToGate = useCallback((msg) => {
    clearSession(token); setSession(null); setNotice(msg || ''); setPhase('gate');
  }, [token]);

  const onUnauthorizedBook = useCallback(() => backToGate('Sesi Anda berakhir.'), [backToGate]);

  const refreshHome = useCallback(async (s) => {
    try { setHome(await portalApi.home(s)); return true; }
    catch (e) { if (e.sessionInvalid) backToGate('Sesi Anda berakhir. Masukkan tanggal lahir lagi.'); return false; }
  }, [backToGate]);

  // Awal: brand klinik, lalu coba sesi tersimpan.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await portalApi.branding(token);
        if (!alive) return;
        if (b.status === 'invalid') { setBlockedReason('invalid'); setPhase('blocked'); return; }
        setBranding(b);
        if (b.status !== 'active') { setBlockedReason(b.status); setPhase('blocked'); return; }
        const saved = loadSession(token);
        if (!saved) { setPhase('gate'); return; }
        try {
          const h = await portalApi.home(saved);
          if (!alive) return;
          setHome(h); setSession(saved); setPhase('app');
        } catch (e) {
          if (!alive) return;
          // Hanya sesi yang benar-benar tidak berlaku yang dihapus. Gangguan jaringan saat refresh
          // tidak boleh mengeluarkan pasien; sesi tetap disimpan dan pasien bisa mencoba lagi.
          if (e.sessionInvalid) { clearSession(token); setPhase('gate'); } else setPhase('retry');
        }
      } catch { if (alive) setPhase('retry'); }
    })();
    return () => { alive = false; };
  }, [token, attempt]);

  const verify = async (dob) => {
    try {
      const res = await portalApi.verify(token, dob);
      if (res.ok) {
        saveSession(token, res.session); setSession(res.session); setNotice('');
        await refreshHome(res.session); setPhase('app');
      }
      return res;
    } catch { return { ok: false, reason: 'error' }; }
  };

  // Data per tab dimuat saat tab dibuka; Beranda disegarkan berkala untuk badge pesan.
  useEffect(() => {
    if (phase !== 'app' || !session) return undefined;
    const guard = (e) => { if (e.sessionInvalid) backToGate('Akses Anda dinonaktifkan atau tautan diganti. Hubungi klinik.'); };
    if (tab === 'prog' || tab === 'home') portalApi.goals(session).then(setGoals).catch(guard);
    if (tab === 'prog') portalApi.progress(session).then(setProgress).catch(guard);
    if (tab === 'lat') portalApi.program(session).then(setProgram).catch(guard);
    if (tab === 'fb') portalApi.listFeedback(session).then(setHistory).catch(guard);
    if (tab === 'home') refreshHome(session);
    return undefined;
  }, [tab, phase, session, backToGate, refreshHome]);
  useEffect(() => {
    if (phase !== 'app' || !session) return undefined;
    const t = setInterval(() => refreshHome(session), 30000);
    return () => clearInterval(t);
  }, [phase, session, refreshHome]);

  // Keluar: sesi di perangkat ini dinonaktifkan di server, lalu pasien kembali ke layar tanggal lahir.
  const logout = async () => {
    try { await portalApi.logout(session); } catch { /* tetap keluar di perangkat ini */ }
    backToGate('Anda sudah keluar dari perangkat ini.');
  };
  const toggleExercise = async (exerciseId, done) => {
    try {
      await portalApi.logExercise(session, exerciseId, done);
    } catch (e) { if (e.sessionInvalid) backToGate('Sesi Anda berakhir.'); else flash('Gagal menyimpan. Coba lagi.'); return; }
    // Sudah tersimpan di server: tampilkan langsung, lalu segarkan daftar dari server.
    setProgram((p) => p.map((i) => (i.exercise_id === exerciseId ? { ...i, done_today: done } : i)));
    flash(done ? 'Latihan dicatat selesai' : 'Tanda selesai dibatalkan');
    portalApi.program(session).then(setProgram).catch(() => {});
  };
  const submitFeedback = async (vas, tags, message) => {
    try {
      await portalApi.submitFeedback(session, vas, tags, message);
      setHistory(await portalApi.listFeedback(session));
      return true;
    } catch (e) {
      if (e.sessionInvalid) backToGate('Sesi Anda berakhir.'); else flash(e.message || 'Gagal mengirim.');
      return false;
    }
  };

  const head = <Helmet><title>{branding?.clinic_name ? `${branding.clinic_name} · Clinara` : 'Clinara'}</title><meta name="robots" content="noindex,nofollow" /></Helmet>;

  if (phase === 'loading') return <div className="pp">{head}<div className="center"><p className="muted">Memuat...</p></div></div>;
  if (phase === 'retry') {
    return (
      <div className="pp">{head}
        <div className="center"><div style={{ maxWidth: 380 }}>
          <h2 style={{ marginBottom: 8 }}>Belum bisa terhubung</h2>
          <p className="muted" style={{ margin: '0 0 16px' }}>Periksa koneksi internet Anda. Data Anda tetap aman tersimpan.</p>
          <button className="btn" onClick={() => { setPhase('loading'); setAttempt((n) => n + 1); }}>Coba lagi</button>
        </div></div>
      </div>
    );
  }
  if (phase === 'blocked') {
    return (
      <div className="pp">{head}
        <div className="center"><div style={{ maxWidth: 380 }}>
          {branding && <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}><Mark clinic={branding} /><b>{branding.clinic_name}</b></div>}
          <h2 style={{ marginBottom: 8 }}>Tautan tidak bisa dipakai</h2>
          <p className="muted" style={{ margin: 0 }}>{REASONS[blockedReason] || REASONS.invalid}</p>
        </div></div>
      </div>
    );
  }
  if (phase === 'gate') return <div className="pp">{head}<div className="pp-col"><Gate branding={branding} onVerify={verify} notice={notice} /></div></div>;

  return (
    <div className="pp">{head}
      <div className="pp-col">
        <div className={`pp-body${tab === 'chat' ? ' chatting' : ''}`}>
          {tab === 'home' && home && <HomeTab home={home} goals={goals} go={setTab} onLogout={logout} />}
          {tab === 'prog' && (progress ? <ProgressTab data={progress} goals={goals} complaint={home?.complaint} /> : <div className="pp-pad" style={{ paddingTop: TOP_PAD }}><p className="muted">Memuat...</p></div>)}
          {tab === 'lat' && <ProgramTab session={session} items={program} therapist={home?.therapist} onToggle={toggleExercise} />}
          {tab === 'fb' && <FeedbackTab token={token} history={history} onSubmit={submitFeedback} />}
          {tab === 'book' && <BookingTab token={token} session={session} onBack={() => setTab('home')} onBooked={() => { refreshHome(session); setTab('home'); }} onUnauthorized={onUnauthorizedBook} />}
          {tab === 'chat' && <ChatTab token={token} session={session} therapist={home?.therapist} clinicName={home?.clinic?.name} onUnauthorized={() => backToGate('Sesi Anda berakhir.')} />}
        </div>
        <nav className="nav" role="tablist" aria-label="Menu">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k || (k === 'home' && tab === 'book')} onClick={() => setTab(k)}>
              <span className="nav-ic"><Icon size={22} strokeWidth={2} aria-hidden="true" /></span><span>{label}</span>
              {k === 'chat' && home?.unread_messages > 0 && tab !== 'chat' && <span className="badge">{home.unread_messages}</span>}
            </button>
          ))}
        </nav>
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </div>
  );
};

export default PatientPortalPage;
