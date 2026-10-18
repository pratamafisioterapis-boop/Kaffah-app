import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Home, TrendingUp, PlayCircle, ClipboardList, MessageCircle, Send, Check, Play, CalendarPlus, CalendarCheck, ChevronLeft, Activity, User } from 'lucide-react';
import { formatOnsetAgo } from '@/lib/onsetHelpers';
import { portalApi, loadSession, saveSession, clearSession, hexToHue } from '@/lib/patientPortal';
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
  return h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
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

const Mark = ({ clinic }) => (
  <span className="mark">{clinic?.logo_url ? <img src={clinic.logo_url} alt="" /> : (clinic?.name || 'C')[0]}</span>
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
      <div className="logo"><Mark clinic={branding} />{branding.clinic_name}</div>
      <h1>Pemulihan Anda ada di sini.</h1>
      <p>{branding.clinic_name} mengirim tautan ini untuk Anda. Masukkan tanggal lahir agar data Anda tetap aman.</p>
      {notice && <p className="notice">{notice}</p>}
      <form className="panel" onSubmit={submit} autoComplete="off">
        <label htmlFor="pp-dd" className="gate-label">Tanggal lahir</label>
        <div className="dob">
          <input id="pp-dd" ref={refs[0]} inputMode="numeric" placeholder="HH" aria-label="Hari" value={v.d} onChange={set('d', 2, 0)} />
          <input ref={refs[1]} inputMode="numeric" placeholder="BB" aria-label="Bulan" value={v.m} onChange={set('m', 2, 1)} />
          <input ref={refs[2]} inputMode="numeric" placeholder="TTTT" aria-label="Tahun" value={v.y} onChange={set('y', 4, 2)} />
        </div>
        <p className="err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Memeriksa...' : 'Masuk'}</button>
        <p className="powered" style={{ marginTop: 14 }}>Didukung Clinara</p>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------- Chart
const VasChart = ({ entries }) => {
  const pts = entries.filter((e) => e.vas != null);
  if (pts.length < 2) return <p className="muted" style={{ margin: '14px 0 0' }}>Grafik muncul setelah dua sesi tercatat.</p>;
  const W = 320, H = 170;
  const x = (i) => 28 + (i * (W - 50)) / (pts.length - 1);
  const y = (n) => 14 + ((10 - n) * (H - 46)) / 10;
  const xy = pts.map((p, i) => [x(i), y(p.vas)]);
  const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const last = xy[xy.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Nyeri dari ${pts[0].vas} menjadi ${pts[pts.length - 1].vas} dari 10`}>
      {[0, 5, 10].map((n) => (
        <g key={n}><line x1="24" x2={W - 14} y1={y(n)} y2={y(n)} stroke="var(--line)" strokeDasharray="3 4" /><text x="0" y={y(n) + 4}>{n}</text></g>
      ))}
      <path d={`${path} L${last[0]} ${y(0)} L${xy[0][0]} ${y(0)}Z`} fill="var(--brand-soft)" opacity=".8" />
      <path d={path} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={i === xy.length - 1 ? 6.5 : 4} fill={i === xy.length - 1 ? 'var(--warm)' : 'var(--surface)'} stroke="var(--brand)" strokeWidth="2" />
          {pts.length <= 7 && <text x={p[0]} y={H - 6} textAnchor="middle">{fmtDate(pts[i].date)}</text>}
        </g>
      ))}
      <text x={last[0]} y={last[1] - 13} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 700, fontSize: 13 }}>{pts[pts.length - 1].vas}</text>
    </svg>
  );
};

// ---------------------------------------------------------------- Tabs
// Goal treatment dari terapis: bilah progres per goal dan titik riwayat per sesi.
const GoalsCard = ({ goals, compact = false }) => {
  if (!goals?.length) return null;
  return (
    <section className="card">
      <h3>Target terapi Anda</h3>
      {goals.map((g) => {
        const hist = g.history || [];
        const prev = hist.length > 1 ? hist[hist.length - 2].progress : null;
        const gain = prev != null && g.progress > prev ? g.progress - prev : 0;
        return (
          <div key={g.id} className="goal">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <b className="sp goal-text">{g.text}</b>
              {g.progress >= 100 ? <span className="pill ok">Tercapai</span> : <span className="num goal-pct">{g.progress}%</span>}
            </div>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.progress} aria-label={g.text}><i style={{ width: `${g.progress}%` }} /></div>
            {!compact && (gain > 0 || hist.length > 1) && (
              <div className="muted small">
                {gain > 0 ? `Naik ${gain} poin sejak sesi sebelumnya. ` : ''}
                {hist.length > 1 ? `Riwayat: ${hist.map((h) => `${h.progress}%`).join(' → ')}` : ''}
              </div>
            )}
          </div>
        );
      })}
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
        <div className="top-in">
          <div className="row">
            <div className="avatar">{initials(home.first_name)}</div>
            <div className="sp"><b className="clinic-name">{home.clinic?.name}</b>
              <div className="top-date">{fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
            {home.sessions_done > 0 ? <span className="pill warm num">Sesi ke-{home.sessions_done}</span> : null}
          </div>
          <h1>{greeting()}, {home.first_name}</h1>
          {(home.complaint || home.therapist) && (
            <div className="hero-meta">
              {home.complaint && <span className="hero-complaint">{home.complaint}</span>}
              {home.therapist && <span className="hero-therapist"><User size={16} strokeWidth={2} aria-hidden="true" />{shortName(home.therapist)}</span>}
            </div>
          )}
        </div>
      </header>
      <div className="pp-pad">
        <div className="pair eq">
          {na ? (
            <section className="card">
              <div className="row" style={{ gap: 16 }}>
                <div className="date-box"><small>{MONTHS[new Date(na.appointment_date).getMonth()]}</small><b className="num">{new Date(na.appointment_date).getDate()}</b></div>
                <div className="sp">
                  <h3>Sesi berikutnya</h3>
                  <div className="next-when">{fmtDate(na.appointment_date, { weekday: 'long' })}, {fmtTime(na.appointment_date)}</div>
                  {na.therapist && <div className="muted">{shortName(na.therapist)}</div>}
                </div>
              </div>
              <button className="btn ghost" onClick={() => go('book')}><CalendarPlus size={20} aria-hidden="true" />Booking jadwal lain</button>
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
                <h3 className="sp">Program rumah hari ini</h3>
                <span className="num prog-count"><b>{home.program_done_today}</b>/{home.program_total}</span>
              </div>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Latihan selesai hari ini"><i style={{ width: `${pct}%` }} /></div>
              <div className="muted">{left === 0 ? 'Semua selesai. Kerja bagus.' : `Sisa ${left} latihan.`}</div>
              <div className="week">
                {(home.week || []).map((d, i) => (
                  <div key={d.date}>{DAYS[i]}<i className={`${d.done ? 'done' : ''} ${d.today ? 'today' : ''}`}><Check size={16} strokeWidth={3} /></i></div>
                ))}
              </div>
              <button className="btn" onClick={() => go('lat')}>{left === 0 ? 'Lihat latihan' : 'Lanjut latihan'}</button>
            </section>
          )}
        </div>
        <div className="stat3">
          <div><b className="num" style={{ color: 'var(--ok)' }}>{home.vas_latest != null ? `${home.vas_latest}/10` : '–'}</b><span>{home.vas_latest != null ? `Nyeri${home.vas_first != null && home.vas_first !== home.vas_latest ? `, awal ${home.vas_first}` : ''}` : 'Nyeri belum tercatat'}</span></div>
          <div><b className="num">{home.streak_days} hari</b><span>Latihan beruntun</span></div>
          <div><b className="num">{home.sessions_done}</b><span>Sesi terapi</span></div>
        </div>
        <div className="pair">
          <GoalsCard goals={goals} compact />
          {home.latest_note && (
            <section className="quote"><h3>Catatan dari terapis</h3><p>{home.latest_note}</p></section>
          )}
        </div>
        {home.latest_education && (
          <section className="card edu">
            <h3>Edukasi dari terapis</h3>
            <p className="edu-text">{home.latest_education}</p>
          </section>
        )}
        <div className="powered">Didukung Clinara · {home.clinic?.name}</div>
        <button className="btn ghost logout" onClick={onLogout}>Keluar dari perangkat ini</button>
      </div>
    </>
  );
};

const GoalsProgress = ({ goals }) => (
  <>
    {goals.map((g) => {
      const start = g.history?.length ? g.history[0].progress : 0;
      return (
        <section className="card" key={g.id}>
          <div className="row" style={{ alignItems: 'flex-start' }}><b className="sp goal-text">{g.text}</b><span className="pill ok num">{g.progress >= 100 ? 'Tercapai' : `${g.progress}% ke target`}</span></div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.progress} aria-label={g.text}><i style={{ width: `${g.progress}%` }} /></div>
          <div className="row num muted small" style={{ justifyContent: 'space-between' }}>
            <span>Awal {start}%</span><b style={{ color: 'var(--ink)' }}>Kini {g.progress}%</b><span>Target 100%</span>
          </div>
        </section>
      );
    })}
  </>
);

const PageHead = ({ title, sub }) => (
  <div className="page-head"><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div>
);

const ProgressTab = ({ data, goals, complaint }) => {
  const [view, setView] = useState('nyeri');
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
      <PageHead title="Perkembangan Anda" sub={[ep?.label || complaint, since].filter(Boolean).join(', ')} />
      {goals?.length > 0 && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={view === 'nyeri'} onClick={() => setView('nyeri')}>Nyeri</button>
          <button role="tab" aria-selected={view === 'goal'} onClick={() => setView('goal')}>Target terapi</button>
        </div>
      )}
      <div className="pair">
        <div className="stack">
          {view === 'goal' && goals?.length > 0 ? <GoalsProgress goals={goals} /> : (
            <section className="card">
              {vasPts.length ? (
                <div className="row">
                  <div className="sp"><h3>Skala nyeri (0–10)</h3>
                    <div className="row" style={{ gap: 10, alignItems: 'baseline', marginTop: 6 }}>
                      <span className="num big-num">{last.vas}</span>
                      <span className="muted">dari 10</span>
                    </div></div>
                  {vasPts.length > 1 && first.vas > last.vas && <span className="pill ok">Turun {first.vas - last.vas} poin</span>}
                </div>
              ) : <p className="muted" style={{ margin: 0 }}>Nilai nyeri akan tampil setelah terapis mencatatnya saat sesi.</p>}
              <VasChart entries={entries} />
            </section>
          )}
        </div>
        <section className="card">
          <h3 style={{ marginBottom: 16 }}>Riwayat sesi</h3>
          {entries.length === 0 ? <p className="muted" style={{ margin: 0 }}>Belum ada sesi tercatat.</p> : (
            <ul className="tl">
              {[...entries].reverse().slice(0, 20).map((e) => (
                <li key={e.no}>
                  <div>
                    <b>{fmtDate(e.date)} · Sesi {e.no}</b>{e.vas != null && <span className="pill num" style={{ marginLeft: 10 }}>Nyeri {e.vas}/10</span>}
                    {e.update && <p>{e.update.charAt(0).toUpperCase() + e.update.slice(1)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {history.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
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
  <div className={`thumb${item.has_video ? '' : ' no-video'}`} aria-hidden="true">
    {item.has_video && (poster
      ? <img src={poster} alt="" decoding="async" onLoad={markReady} />
      // Belum ada sampul: ambil satu bingkai dari videonya (lebih lambat).
      : poster === null && url && <video src={`${url}#t=0.5`} muted playsInline preload="metadata" tabIndex={-1} onLoadedData={markReady} />)}
    {item.has_video ? <span className="play"><Play size={18} fill="currentColor" /></span> : <Activity size={30} strokeWidth={1.6} />}
  </div>
);

const ProgramTab = ({ session, items, therapist, onToggle }) => {
  const [openId, setOpenId] = useState(null);
  const [urls, loadUrl, posters] = useVideoUrls(session, items);
  const cur = items.find((i) => i.exercise_id === openId);
  const curUrl = cur ? urls[cur.exercise_id] : undefined;
  const doneCount = items.filter((i) => i.done_today).length;

  return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
      <PageHead title="Latihan hari ini" sub={`${therapist ? `Dari ${shortName(therapist)}. ` : ''}Berhenti jika nyeri lebih dari 5/10 dan kabari terapis.`} />
      {items.length > 0 && <p className="muted ex-count num" style={{ margin: 0 }}>{doneCount} dari {items.length} latihan selesai</p>}
      {items.length === 0 && <div className="card muted">Terapis belum memberi latihan. Latihan akan tampil di sini setelah sesi berikutnya.</div>}
      <div className="ex-grid">
        {items.map((e) => (
          <div className="card ex" key={e.exercise_id}>
            <button className="vid" onClick={() => setOpenId(e.exercise_id)} aria-label={`Buka ${e.title}`}>
              <Thumb item={e} url={urls[e.exercise_id]} poster={posters[e.exercise_id]} />
              <div className="sp"><b className="ex-title">{e.title}</b><span className="muted small">{e.dose}</span></div>
              <span className={`check ${e.done_today ? 'on' : ''}`} aria-label={e.done_today ? 'Selesai' : 'Belum selesai'}><Check size={18} strokeWidth={3} /></span>
            </button>
          </div>
        ))}
      </div>
      {cur && (
        <div className="sheet" onClick={(ev) => { if (ev.target === ev.currentTarget) setOpenId(null); }}>
          <div role="dialog" aria-label={cur.title}>
            <div className="grab" />
            {cur.has_video && (
              <div className="player">
                {curUrl ? <video key={curUrl} src={curUrl} controls playsInline preload="metadata" onError={() => loadUrl(cur.exercise_id, true)} />
                  : curUrl === null ? <span>Video belum bisa diputar. Ikuti langkah di bawah ini.</span>
                  : <span>Memuat video...</span>}
              </div>
            )}
            <h2 style={{ margin: '16px 0 4px' }}>{cur.title}</h2>
            {cur.dose && <div className="muted" style={{ marginBottom: 14 }}>{cur.dose}</div>}
            {cur.how_to && <><h3 className="sheet-h">Cara melakukan</h3>
              {toSteps(cur.how_to) ? <ol className="steps">{toSteps(cur.how_to).map((x, i) => <li key={i}>{x}</li>)}</ol> : <p className="sheet-p">{cur.how_to}</p>}</>}
            {cur.progression && <><h3 className="sheet-h">Jika sudah terasa ringan</h3><p className="sheet-p">{cur.progression}</p></>}
            {cur.caution && <><h3 className="sheet-h" style={{ color: 'var(--warm)' }}>Perhatian</h3><p className="sheet-p">{cur.caution}</p></>}
            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn ghost" style={{ width: '36%' }} onClick={() => setOpenId(null)}>Tutup</button>
              <button className="btn" onClick={async () => { await onToggle(cur.exercise_id, !cur.done_today); setOpenId(null); }}>{cur.done_today ? 'Batalkan selesai' : 'Tandai selesai'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PAIN_LEVELS = [[0, 'Tidak nyeri'], [3, 'Nyeri ringan'], [6, 'Nyeri sedang'], [10, 'Nyeri berat']];
const painLabel = (v) => PAIN_LEVELS.find(([max]) => v <= max)[1];
const painFace = (v) => `/pain/${v}.png`;

// Skala nyeri 0-10: wajah besar yang berubah mengikuti pilihan, geser atau ketuk angka.
const PainScale = ({ value, onChange }) => {
  const track = useRef(null);
  const pick = (clientX) => {
    const r = track.current.getBoundingClientRect();
    onChange(Math.max(0, Math.min(10, Math.round(((clientX - r.left) / r.width) * 10))));
  };
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step) { e.preventDefault(); onChange(Math.max(0, Math.min(10, value + step))); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(0); }
    else if (e.key === 'End') { e.preventDefault(); onChange(10); }
  };
  return (
    <div className="pain" style={{ '--pv': value / 10 }}>
      <div className="pain-hero" aria-hidden="true">
        <img key={value} src={painFace(value)} alt="" width="96" height="96" draggable="false" />
      </div>
      <div className="pain-read" aria-live="polite"><b className="num">{value}</b>/10 — {painLabel(value)}</div>
      <div ref={track} className="pain-track" role="slider" tabIndex={0} aria-labelledby="pp-vas-l"
        aria-valuemin={0} aria-valuemax={10} aria-valuenow={value} aria-valuetext={`${value} dari 10, ${painLabel(value)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') pick(e.clientX); }}>
        <div className="pain-bar"><i style={{ width: `${value * 10}%` }} /></div>
        {Array.from({ length: 11 }, (_, v) => (
          <span key={v} className={`pain-dot${v === value ? ' on' : ''}`} style={{ left: `${v * 10}%` }}>
            <img src={painFace(v)} alt="" draggable="false" loading="lazy" />
            <em className="num">{v}</em>
          </span>
        ))}
      </div>
    </div>
  );
};

const FeedbackTab = ({ history, onSubmit }) => {
  const [vas, setVas] = useState(3);
  const [tags, setTags] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit(vas, tags, msg.trim());
    setBusy(false);
    if (ok) { setTags([]); setMsg(''); }
  };
  return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
      <PageHead title="Apa yang Anda rasakan hari ini?" sub="Terapis membaca ini sebelum sesi berikutnya." />
      <div className="pair">
        <form className="card form" onSubmit={submit}>
          <div className="field"><label id="pp-vas-l">Seberapa nyeri yang Anda rasakan saat ini?</label>
            <PainScale value={vas} onChange={setVas} /></div>
          <div className="field"><label>Keluhan yang muncul</label>
            <div className="chips">{TAGS.map((t) => (
              <button type="button" key={t} className="chip" aria-pressed={tags.includes(t)} onClick={() => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</button>
            ))}</div></div>
          <div className="field"><label htmlFor="pp-msg">Cerita singkat (opsional)</label>
            <textarea id="pp-msg" maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Misalnya: nyeri muncul setelah jalan kaki 15 menit." /></div>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim ke terapis'}</button>
        </form>
        <section className="card"><h3>Riwayat laporan Anda</h3>
          {history.length === 0 && <p className="muted" style={{ margin: '10px 0 0' }}>Belum ada laporan.</p>}
          {history.map((f) => (
            <div className="hist" key={f.at}>
              <div className="row"><b className="sp">{fmtDate(f.at)}</b><span className="pill num">Nyeri {f.vas}/10</span></div>
              <p className="muted" style={{ margin: '8px 0 0' }}>{[(f.tags || []).join(', '), f.message].filter(Boolean).join('. ') || 'Tanpa catatan.'}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

// Booking jadwal terapi. Terapis yang terakhir menangani pasien tampil lebih dulu; bila jadwalnya penuh
// di tanggal itu, terapis lain yang masih punya slot ditawarkan di bawahnya.
const BookingTab = ({ session, onBack, onBooked, onUnauthorized }) => {
  const [opts, setOpts] = useState(null);
  const [slots, setSlots] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [date, setDate] = useState(null);
  const [pick, setPick] = useState(null); // { therapist_id, start }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [o, sl] = await Promise.all([portalApi.bookingOptions(session), portalApi.bookingSlots(session, 14)]);
      setOpts(o); setSlots(sl);
      const lastId = o.last_therapist_id;
      const dates = [...new Set(sl.map((x) => x.date))].sort();
      setDate((cur) => cur || dates.find((d) => sl.some((x) => x.date === d && x.therapist_id === lastId)) || dates[0] || null);
    } catch (e) {
      if (e.sessionInvalid) onUnauthorized(); else setLoadError('Jadwal belum bisa dimuat. Periksa koneksi lalu coba lagi.');
    }
  }, [session, onUnauthorized]);
  useEffect(() => { load(); }, [load]);

  if (done) {
    return (
      <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
        <section className="card done-card">
          <span className="done-mark"><CalendarCheck size={30} strokeWidth={2} aria-hidden="true" /></span>
          <h2>Jadwal terbooking</h2>
          <p className="done-when">{fmtDate(done.appointment_date, { weekday: 'long', day: 'numeric', month: 'long' })}, {fmtTime(done.appointment_date)}</p>
          <p className="muted">Bersama {shortName(done.therapist)}. Klinik menerima pemberitahuan booking Anda.</p>
          <button className="btn" onClick={onBooked}>Kembali ke beranda</button>
        </section>
      </div>
    );
  }

  const head = (
    <>
      <button className="back" onClick={onBack}><ChevronLeft size={22} aria-hidden="true" />Kembali</button>
      <PageHead title="Booking jadwal" sub="Pilih hari, terapis, dan jam." />
    </>
  );

  if (loadError) return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>{head}
      <section className="card"><p style={{ margin: '0 0 14px' }} role="alert">{loadError}</p><button className="btn" onClick={load}>Coba lagi</button></section>
    </div>
  );
  if (!opts || !slots) return <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>{head}<p className="muted">Memuat jadwal...</p></div>;

  const lastId = opts.last_therapist_id;
  const therapists = opts.therapists || [];
  const dates = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toLocaleDateString('sv-SE'); });
  const countOn = (d) => slots.filter((x) => x.date === d).length;
  const onDay = slots.filter((x) => x.date === date);
  const by = (id) => onDay.filter((x) => x.therapist_id === id);
  const lastT = therapists.find((t) => t.id === lastId);
  const others = therapists.filter((t) => t.id !== lastId && by(t.id).length > 0);
  const lastNext = lastT && by(lastId).length === 0 ? dates.find((d) => d > date && slots.some((x) => x.date === d && x.therapist_id === lastId)) : null;
  const pickedT = pick && therapists.find((t) => t.id === pick.therapist_id);

  const choose = (therapist_id, start) => { setPick({ therapist_id, start }); setError(''); };
  const confirm = async () => {
    setBusy(true); setError('');
    try {
      setDone(await portalApi.book(session, pick.therapist_id, date, pick.start, note.trim()));
    } catch (e) {
      if (e.sessionInvalid) onUnauthorized();
      else { setError(e.message || 'Booking gagal. Coba lagi.'); setPick(null); load(); }
    }
    setBusy(false);
  };

  const renderSlots = (t) => (
    <div className="slots">
      {by(t.id).map((x) => (
        <button key={x.start} className="slot num" aria-pressed={pick?.therapist_id === t.id && pick.start === x.start} onClick={() => choose(t.id, x.start)}>{dotTime(x.start)}</button>
      ))}
    </div>
  );
  const renderWho = (t, badge) => (
    <div className="row who">
      <span className="avatar sm">{t.avatar_url ? <img src={t.avatar_url} alt="" /> : initials(shortName(t.name))}</span>
      <div className="sp"><b>{shortName(t.name)}</b>{t.specialization && <div className="muted small">{t.specialization}</div>}
        {badge && <span className="pill warm">{badge}</span>}</div>
    </div>
  );

  return (
    <div className="pp-pad book" style={{ paddingTop: TOP_PAD }}>
      {head}
      <div className="dates" role="tablist" aria-label="Pilih tanggal">
        {dates.map((d) => {
          const n = countOn(d); const dt = dayOf(d);
          return (
            <button key={d} role="tab" className="date" aria-selected={date === d} disabled={n === 0} onClick={() => { setDate(d); setPick(null); }}>
              <small>{d === dates[0] ? 'Hari ini' : WEEKDAYS[dt.getDay()]}</small><b className="num">{dt.getDate()}</b><i className={n ? 'has' : ''} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {!date ? (
        <section className="card"><h3>Belum ada jadwal kosong</h3><p className="muted" style={{ margin: '6px 0 14px' }}>Semua slot dua minggu ke depan terisi. Hubungi klinik lewat Chat agar dicarikan jadwal.</p></section>
      ) : (
        <div className="pair">
          {lastT && (
            <section className="card">
              {renderWho(lastT, 'Terakhir menangani Anda')}
              {by(lastId).length ? renderSlots(lastT) : (
                <div className="full-note">
                  <p style={{ margin: 0 }}>Jadwal {shortName(lastT.name)} penuh di tanggal ini.</p>
                  {lastNext && <button className="btn ghost" onClick={() => { setDate(lastNext); setPick(null); }}>Lihat {fmtDate(lastNext, { weekday: 'long', day: 'numeric', month: 'short' })}</button>}
                </div>
              )}
            </section>
          )}
          {others.length > 0 && (
            <section className="card">
              <h3>{lastT && by(lastId).length === 0 ? 'Terapis lain yang tersedia' : 'Terapis lain'}</h3>
              {others.map((t) => (<div key={t.id} className="other">{renderWho(t)}{renderSlots(t)}</div>))}
            </section>
          )}
          {!lastT && others.length === 0 && <section className="card"><p className="muted" style={{ margin: 0 }}>Tidak ada slot di tanggal ini. Pilih tanggal lain.</p></section>}
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      {pick && pickedT && (
        <div className="confirm-bar">
          <div className="sp">
            <b>{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}, {dotTime(pick.start)}</b>
            <div className="muted small">{shortName(pickedT.name)}</div>
            <input className="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Catatan untuk terapis (opsional)" aria-label="Catatan untuk terapis" />
          </div>
          <button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Memproses...' : 'Konfirmasi'}</button>
        </div>
      )}
    </div>
  );
};

const ChatTab = ({ session, therapist, clinicName, onUnauthorized }) => {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
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
        <span className="avatar" style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>{initials((therapist || clinicName || '').replace(/^Ft\.?\s*/i, ''))}</span>
        <div className="sp"><b>{therapist ? shortName(therapist) : 'Terapis Anda'}</b><div className="muted small">{clinicName}. Balasan datang saat terapis sedang bertugas.</div></div>
      </div>
      <div className="msgs" ref={box}>
        {msgs.length === 0 ? <p className="muted" style={{ textAlign: 'center' }}>Belum ada pesan. Tulis pertanyaan Anda di bawah.</p> : <div className="day">Percakapan</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`m ${m.sender === 'patient' ? 'me' : 'them'}`}>{m.body}<small className="num">{fmtTime(m.at)}</small></div>
        ))}
      </div>
      {error && <p className="err" style={{ padding: '0 20px' }} role="alert">{error}</p>}
      <div className="qs">
        {['Boleh latihan hari ini?', 'Nyeri bertambah', 'Ganti jadwal sesi'].map((q) => <button key={q} type="button" onClick={() => send(null, q)}>{q}</button>)}
      </div>
      <form className="compose" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan" aria-label="Pesan" maxLength={2000} />
        <button className="send" aria-label="Kirim"><Send size={22} /></button>
      </form>
    </>
  );
};

// ---------------------------------------------------------------- Page
const PatientPortalPage = () => {
  const { token } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | blocked | gate | app
  const [branding, setBranding] = useState(null);
  const [blockedReason, setBlockedReason] = useState('invalid');
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('home');
  const [home, setHome] = useState(null);
  const [progress, setProgress] = useState(null);
  const [goals, setGoals] = useState([]);
  const [program, setProgram] = useState([]);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState('');

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const hue = hexToHue(branding?.brand_color);

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
        if (saved && (await portalApi.home(saved).then((h) => { setHome(h); return true; }).catch(() => false))) {
          setSession(saved); setPhase('app');
        } else { clearSession(token); setPhase('gate'); }
      } catch { if (alive) { setBlockedReason('invalid'); setPhase('blocked'); } }
    })();
    return () => { alive = false; };
  }, [token]);

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
      setProgram(await portalApi.program(session));
      flash(done ? 'Latihan dicatat selesai' : 'Tanda selesai dibatalkan');
    } catch (e) { if (e.sessionInvalid) backToGate('Sesi Anda berakhir.'); else flash('Gagal menyimpan. Coba lagi.'); }
  };
  const submitFeedback = async (vas, tags, message) => {
    try {
      await portalApi.submitFeedback(session, vas, tags, message);
      setHistory(await portalApi.listFeedback(session));
      flash('Terkirim ke terapis');
      return true;
    } catch (e) {
      if (e.sessionInvalid) backToGate('Sesi Anda berakhir.'); else flash(e.message || 'Gagal mengirim.');
      return false;
    }
  };

  const style = { '--h': hue };
  const head = <Helmet><title>{branding?.clinic_name ? `${branding.clinic_name} · Clinara` : 'Clinara'}</title><meta name="robots" content="noindex,nofollow" /></Helmet>;

  if (phase === 'loading') return <div className="pp" style={style}>{head}<div className="center"><p className="muted">Memuat...</p></div></div>;
  if (phase === 'blocked') {
    return (
      <div className="pp" style={style}>{head}
        <div className="center"><div style={{ maxWidth: 380 }}>
          {branding && <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}><Mark clinic={branding} /><b>{branding.clinic_name}</b></div>}
          <h2 style={{ marginBottom: 8 }}>Tautan tidak bisa dipakai</h2>
          <p className="muted" style={{ margin: 0 }}>{REASONS[blockedReason] || REASONS.invalid}</p>
        </div></div>
      </div>
    );
  }
  if (phase === 'gate') return <div className="pp" style={style}>{head}<div className="pp-col"><Gate branding={branding} onVerify={verify} notice={notice} /></div></div>;

  return (
    <div className="pp" style={style}>{head}
      <div className="pp-col">
        <div className={`pp-body${tab === 'chat' ? ' chatting' : ''}`}>
          {tab === 'home' && home && <HomeTab home={home} goals={goals} go={setTab} onLogout={logout} />}
          {tab === 'prog' && (progress ? <ProgressTab data={progress} goals={goals} complaint={home?.complaint} /> : <div className="pp-pad" style={{ paddingTop: TOP_PAD }}><p className="muted">Memuat...</p></div>)}
          {tab === 'lat' && <ProgramTab session={session} items={program} therapist={home?.therapist} onToggle={toggleExercise} />}
          {tab === 'fb' && <FeedbackTab history={history} onSubmit={submitFeedback} />}
          {tab === 'book' && <BookingTab session={session} onBack={() => setTab('home')} onBooked={() => { refreshHome(session); setTab('home'); }} onUnauthorized={onUnauthorizedBook} />}
          {tab === 'chat' && <ChatTab session={session} therapist={home?.therapist} clinicName={home?.clinic?.name} onUnauthorized={() => backToGate('Sesi Anda berakhir.')} />}
        </div>
        <nav className="nav" role="tablist" aria-label="Menu">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k || (k === 'home' && tab === 'book')} onClick={() => setTab(k)}>
              <Icon size={24} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
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
