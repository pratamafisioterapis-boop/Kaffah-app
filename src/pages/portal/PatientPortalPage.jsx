import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Home, TrendingUp, PlayCircle, ClipboardList, MessageCircle, Send, Check, Play } from 'lucide-react';
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
const fmtDuration = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : null);
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
      {notice && <p style={{ color: 'var(--hero-ink)', fontWeight: 600 }}>{notice}</p>}
      <form className="panel" onSubmit={submit} autoComplete="off">
        <label htmlFor="pp-dd" style={{ fontWeight: 600, fontSize: 13 }}>Tanggal lahir</label>
        <div className="dob">
          <input id="pp-dd" ref={refs[0]} inputMode="numeric" placeholder="HH" aria-label="Hari" value={v.d} onChange={set('d', 2, 0)} />
          <input ref={refs[1]} inputMode="numeric" placeholder="BB" aria-label="Bulan" value={v.m} onChange={set('m', 2, 1)} />
          <input ref={refs[2]} inputMode="numeric" placeholder="TTTT" aria-label="Tahun" value={v.y} onChange={set('y', 4, 2)} />
        </div>
        <p className="err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Memeriksa...' : 'Masuk'}</button>
        <p className="powered" style={{ marginTop: 12 }}>Didukung Clinara</p>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------- Chart
const VasChart = ({ entries }) => {
  const pts = entries.filter((e) => e.vas != null);
  if (pts.length < 2) return <p style={{ color: 'var(--muted)', margin: '12px 0 0' }}>Grafik muncul setelah dua sesi tercatat.</p>;
  const W = 300, H = 150;
  const x = (i) => 26 + (i * (W - 46)) / (pts.length - 1);
  const y = (n) => 12 + ((10 - n) * (H - 40)) / 10;
  const xy = pts.map((p, i) => [x(i), y(p.vas)]);
  const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const last = xy[xy.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Nyeri dari ${pts[0].vas} menjadi ${pts[pts.length - 1].vas} dari 10`}>
      {[0, 5, 10].map((n) => (
        <g key={n}><line x1="22" x2={W - 14} y1={y(n)} y2={y(n)} stroke="var(--line)" strokeDasharray="3 4" /><text x="0" y={y(n) + 3}>{n}</text></g>
      ))}
      <path d={`${path} L${last[0]} ${y(0)} L${xy[0][0]} ${y(0)}Z`} fill="var(--brand-soft)" opacity=".8" />
      <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={i === xy.length - 1 ? 6 : 3.5} fill={i === xy.length - 1 ? 'var(--warm)' : 'var(--surface)'} stroke="var(--brand)" strokeWidth="2" />
          {pts.length <= 8 && <text x={p[0]} y={H - 6} textAnchor="middle">{fmtDate(pts[i].date)}</text>}
        </g>
      ))}
      <text x={last[0]} y={last[1] - 11} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 700, fontSize: 11 }}>{pts[pts.length - 1].vas}</text>
    </svg>
  );
};

// ---------------------------------------------------------------- Tabs
const HomeTab = ({ home, go }) => {
  const na = home.next_appointment;
  const pct = home.program_total ? Math.round((home.program_done_today / home.program_total) * 100) : 0;
  const left = home.program_total - home.program_done_today;
  return (
    <>
      <div className="top">
        <div className="row">
          <Mark clinic={home.clinic} />
          <b className="sp" style={{ fontSize: 14 }}>{home.clinic?.name}</b>
          {home.sessions_total ? <span className="pill warm num">Sesi {home.sessions_done}/{home.sessions_total}</span> : null}
        </div>
        <h1>Halo, {home.first_name}</h1>
        {home.complaint && <p>{home.complaint}</p>}
      </div>
      <div className="pp-pad">
        {na && (
          <div className="card row" style={{ gap: 14 }}>
            <div className="date-box"><small>{MONTHS[new Date(na.appointment_date).getMonth()]}</small><b className="num">{new Date(na.appointment_date).getDate()}</b></div>
            <div className="sp">
              <div className="eyebrow">Sesi berikutnya</div>
              <h3>{fmtDate(na.appointment_date, { weekday: 'long' })}, {fmtTime(na.appointment_date)} WIB</h3>
              {na.therapist && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{na.therapist}</div>}
            </div>
          </div>
        )}
        {home.program_total > 0 && (
          <div className="card">
            <div className="row">
              <div className="pp-ring" style={{ '--p': pct }}><span className="num">{home.program_done_today}/{home.program_total}</span></div>
              <div className="sp">
                <h3>Program rumah hari ini</h3>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{left === 0 ? 'Semua selesai. Kerja bagus.' : `Sisa ${left} latihan.`}</div>
              </div>
            </div>
            <div className="week">
              {(home.week || []).map((d, i) => (
                <div key={d.date}>{DAYS[i]}<i className={`${d.done ? 'done' : ''} ${d.today ? 'today' : ''}`}><Check size={14} strokeWidth={3} /></i></div>
              ))}
            </div>
            <button className="btn" onClick={() => go('lat')}>Lanjut latihan</button>
          </div>
        )}
        <div className="stat3">
          <div><b className="num" style={{ color: 'var(--ok)' }}>{home.vas_latest ?? '-'}/10</b><span>Nyeri{home.vas_first != null ? `, dari ${home.vas_first} di awal` : ''}</span></div>
          <div><b className="num">{home.streak_days} hari</b><span>Latihan beruntun</span></div>
          <div><b className="num">{home.sessions_done}{home.sessions_total ? `/${home.sessions_total}` : ''}</b><span>Sesi terapi</span></div>
        </div>
        {home.latest_note && (
          <div className="quote"><div className="eyebrow">Catatan dari terapis</div><p>{home.latest_note}</p></div>
        )}
        <div className="powered">Didukung Clinara · {home.clinic?.name}</div>
      </div>
    </>
  );
};

const ProgressTab = ({ data }) => {
  const [view, setView] = useState('nyeri');
  const entries = data.entries || [];
  // Ukuran gerak/kekuatan: awal = start atau nilai pertama, kini = nilai terakhir, target dari entri terbaru.
  const keys = [];
  entries.forEach((e) => (e.measures || []).forEach((m) => { if (!keys.includes(m.key)) keys.push(m.key); }));
  const measures = keys.map((k) => {
    const series = entries.map((e) => (e.measures || []).find((m) => m.key === k)).filter(Boolean);
    const first = series[0], last = series[series.length - 1];
    const start = first.start ?? first.value;
    const pct = last.target != null && last.target !== start
      ? Math.max(0, Math.min(100, Math.round(((last.value - start) / (last.target - start)) * 100))) : null;
    return { key: k, label: last.label, unit: last.unit || '', start, now: last.value, target: last.target, pct };
  });
  const vasPts = entries.filter((e) => e.vas != null);
  return (
    <div className="pp-pad" style={{ paddingTop: 24 }}>
      <div><div className="eyebrow">Perkembangan Anda</div><h2>Riwayat terapi</h2></div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={view === 'nyeri'} onClick={() => setView('nyeri')}>Nyeri</button>
        <button role="tab" aria-selected={view === 'gerak'} onClick={() => setView('gerak')}>Gerak & kekuatan</button>
      </div>
      {view === 'nyeri' ? (
        <div className="card">
          {vasPts.length ? (
            <div className="row">
              <div className="sp"><div className="eyebrow">Skala nyeri VAS</div>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 34, fontWeight: 700 }}>{vasPts[vasPts.length - 1].vas}</span>
                  <span style={{ color: 'var(--muted)' }}>dari 10</span>
                </div></div>
              {vasPts.length > 1 && vasPts[0].vas > vasPts[vasPts.length - 1].vas && (
                <span className="pill ok">Turun {vasPts[0].vas - vasPts[vasPts.length - 1].vas} poin</span>
              )}
            </div>
          ) : <p style={{ margin: 0, color: 'var(--muted)' }}>Belum ada pengukuran nyeri.</p>}
          <VasChart entries={entries} />
        </div>
      ) : measures.length ? measures.map((m) => (
        <div className="card" key={m.key}>
          <div className="row"><b className="sp">{m.label}</b>{m.pct != null && <span className="pill ok num">{m.pct}% ke target</span>}</div>
          {m.pct != null && <div className="bar"><i style={{ width: `${m.pct}%` }} /></div>}
          <div className="row num" style={{ fontSize: 12, color: 'var(--muted)', justifyContent: 'space-between' }}>
            <span>Awal {m.start}{m.unit}</span><b style={{ color: 'var(--ink)' }}>Kini {m.now}{m.unit}</b>{m.target != null && <span>Target {m.target}{m.unit}</span>}
          </div>
        </div>
      )) : <div className="card" style={{ color: 'var(--muted)' }}>Ukuran gerak dan kekuatan akan tampil setelah terapis mencatatnya.</div>}
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Riwayat sesi</h3>
        {entries.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}>Belum ada sesi tercatat.</p> : (
          <ul className="tl">
            {[...entries].reverse().slice(0, 12).map((e) => (
              <li key={e.no}><div><b>{fmtDate(e.date)} · Sesi {e.no}{data.sessions_total ? `/${data.sessions_total}` : ''}</b>{e.note && <p>{e.note}</p>}</div></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const ProgramTab = ({ items, onToggle }) => {
  const [openId, setOpenId] = useState(null);
  const cur = items.find((i) => i.program_id === openId);
  return (
    <div className="pp-pad" style={{ paddingTop: 24 }}>
      <div><div className="eyebrow">Program rumah</div><h2>Latihan hari ini</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>Berhenti jika nyeri terasa lebih dari 5 dari 10 dan kabari terapis.</p></div>
      {items.length === 0 && <div className="card" style={{ color: 'var(--muted)' }}>Terapis belum memberi latihan. Latihan akan tampil di sini.</div>}
      {items.map((e) => (
        <div className="card" key={e.program_id}>
          <button className="vid" onClick={() => setOpenId(e.program_id)} aria-label={`Buka ${e.title}`}>
            <div className="thumb"><div className="play"><Play size={14} fill="currentColor" /></div>{fmtDuration(e.duration_seconds) && <small className="num">{fmtDuration(e.duration_seconds)}</small>}</div>
            <div className="sp"><b style={{ fontSize: 15, lineHeight: 1.25, display: 'block' }}>{e.title}</b><span style={{ fontSize: 12, color: 'var(--muted)' }}>{e.sets_reps}</span></div>
            <span className={`check ${e.done_today ? 'on' : ''}`}><Check size={14} strokeWidth={3} /></span>
          </button>
        </div>
      ))}
      {cur && (
        <div className="sheet" onClick={(ev) => { if (ev.target === ev.currentTarget) setOpenId(null); }}>
          <div role="dialog" aria-label={cur.title}>
            <div className="grab" />
            <div className="player">
              {cur.video_url ? <video src={cur.video_url} controls playsInline preload="metadata" /> : <span>Video belum tersedia. Ikuti langkah di bawah ini.</span>}
            </div>
            <h2 style={{ margin: '14px 0 4px' }}>{cur.title}</h2>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>{cur.sets_reps}</div>
            {cur.description && <p style={{ margin: '0 0 8px', fontSize: 14, whiteSpace: 'pre-wrap' }}>{cur.description}</p>}
            {cur.notes && <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>Catatan terapis: {cur.notes}</p>}
            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn ghost" style={{ width: '36%' }} onClick={() => setOpenId(null)}>Tutup</button>
              <button className="btn" onClick={async () => { await onToggle(cur.program_id, !cur.done_today); setOpenId(null); }}>{cur.done_today ? 'Batalkan selesai' : 'Tandai selesai'}</button>
            </div>
          </div>
        </div>
      )}
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
    <div className="pp-pad" style={{ paddingTop: 24 }}>
      <div><div className="eyebrow">Umpan balik</div><h2>Apa yang Anda rasakan hari ini?</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>Terapis membaca ini sebelum sesi berikutnya.</p></div>
      <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field"><label htmlFor="pp-vas">Tingkat nyeri sekarang: <b className="num">{vas}</b>/10</label>
          <input id="pp-vas" type="range" min="0" max="10" value={vas} onChange={(e) => setVas(+e.target.value)} />
          <div className="faces"><span>Tidak nyeri</span><span>Sangat nyeri</span></div></div>
        <div className="field"><label>Keluhan yang muncul</label>
          <div className="chips">{TAGS.map((t) => (
            <button type="button" key={t} className="chip" aria-pressed={tags.includes(t)} onClick={() => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</button>
          ))}</div></div>
        <div className="field"><label htmlFor="pp-msg">Cerita singkat (opsional)</label>
          <textarea id="pp-msg" maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Misalnya: nyeri muncul setelah jalan kaki 15 menit." /></div>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim ke terapis'}</button>
      </form>
      <div className="card"><h3>Riwayat laporan Anda</h3>
        {history.length === 0 && <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Belum ada laporan.</p>}
        {history.map((f) => (
          <div className="hist" key={f.at}>
            <div className="row"><b className="sp">{fmtDate(f.at)}</b><span className="pill num">Nyeri {f.vas}/10</span></div>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)' }}>{[(f.tags || []).join(', '), f.message].filter(Boolean).join('. ') || 'Tanpa catatan.'}</p>
          </div>
        ))}
      </div>
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

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText(''); setError('');
    try { await portalApi.sendMessage(session, body); await load(); }
    catch (err) { if (err.sessionInvalid) onUnauthorized(); else { setError(err.message); setText(body); } }
  };

  return (
    <>
      <div className="chat-head">
        <span className="mark">{initials(therapist || clinicName)}</span>
        <div className="sp"><b>{therapist || 'Terapis Anda'}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>{clinicName}. Balasan datang saat terapis sedang bertugas.</div></div>
      </div>
      <div className="msgs" ref={box}>
        {msgs.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Belum ada pesan. Tulis pertanyaan Anda di bawah.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`m ${m.sender === 'patient' ? 'me' : 'them'}`}>{m.body}<small className="num">{fmtTime(m.at)}</small></div>
        ))}
      </div>
      {error && <p className="err" style={{ padding: '0 18px' }} role="alert">{error}</p>}
      <form className="compose" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan" aria-label="Pesan" maxLength={2000} />
        <button className="send" aria-label="Kirim"><Send size={20} /></button>
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
  const [program, setProgram] = useState([]);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState('');

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const hue = hexToHue(branding?.brand_color);

  const backToGate = useCallback((msg) => {
    clearSession(token); setSession(null); setNotice(msg || ''); setPhase('gate');
  }, [token]);

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

  const toggleExercise = async (programId, done) => {
    try {
      await portalApi.logExercise(session, programId, done);
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

  if (phase === 'loading') return <div className="pp" style={style}>{head}<div className="center"><p style={{ color: 'var(--muted)' }}>Memuat...</p></div></div>;
  if (phase === 'blocked') {
    return (
      <div className="pp" style={style}>{head}
        <div className="center"><div style={{ maxWidth: 340 }}>
          {branding && <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}><Mark clinic={branding} /><b>{branding.clinic_name}</b></div>}
          <h2 style={{ marginBottom: 8 }}>Tautan tidak bisa dipakai</h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>{REASONS[blockedReason] || REASONS.invalid}</p>
        </div></div>
      </div>
    );
  }
  if (phase === 'gate') return <div className="pp" style={style}>{head}<div className="pp-col"><Gate branding={branding} onVerify={verify} notice={notice} /></div></div>;

  return (
    <div className="pp" style={style}>{head}
      <div className="pp-col">
        <div className="pp-body">
          {tab === 'home' && home && <HomeTab home={home} go={setTab} />}
          {tab === 'prog' && (progress ? <ProgressTab data={progress} /> : <div className="pp-pad"><p style={{ color: 'var(--muted)' }}>Memuat...</p></div>)}
          {tab === 'lat' && <ProgramTab items={program} onToggle={toggleExercise} />}
          {tab === 'fb' && <FeedbackTab history={history} onSubmit={submitFeedback} />}
          {tab === 'chat' && <ChatTab session={session} therapist={home?.therapist} clinicName={home?.clinic?.name} onUnauthorized={() => backToGate('Sesi Anda berakhir.')} />}
        </div>
        <nav className="nav" role="tablist" aria-label="Menu">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              <Icon size={22} strokeWidth={1.8} />{label}
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
