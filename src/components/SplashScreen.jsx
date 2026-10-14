import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/customSupabaseClient";

// Shared with App.jsx, which covers the screen with the same backdrop while the
// session is being checked, so there is no colour jump when the splash starts.
export const SPLASH_BACKDROP = 'radial-gradient(ellipse 120% 55% at 25% 0%, #0d1b2a 0%, #0a0a0b 62%, #070708 100%)';

const dailyQuotes = [
  "🤲 Semoga Allah mudahkan setiap ikhtiar hari ini.",
  "🌿 Hari yang baik dimulai dengan niat yang baik.",
  "✨ Sedikit demi sedikit, hasil besar akan mengikuti.",
  "💙 Senyum yang tulus adalah awal pelayanan terbaik.",
  "🌙 Awali dengan doa, akhiri dengan syukur.",
  "🤍 Semoga setiap langkah hari ini bernilai ibadah.",
  "☀️ Semoga hari ini lebih baik dari kemarin.",
  "🌸 Kebaikan kecil dapat memberi dampak yang besar.",
  "🌿 Bekerja dengan hati, melayani dengan empati.",
  "✨ Semoga dimudahkan dalam setiap urusan.",
  "🤲 Rezeki terbaik datang bersama keberkahan.",
  "💙 Jadilah alasan seseorang merasa lebih baik hari ini.",
  "🌙 Tetap rendah hati dalam setiap pencapaian.",
  "🌿 Kesabaran adalah kekuatan yang tidak terlihat.",
  "✨ Fokus pada proses, hasil akan mengikuti.",
  "🌾 Padi menguning di tengah sawah, semoga hari ini penuh berkah.",
  "🕊️ Burung terbang ke atas awan, semoga urusan dimudahkan Tuhan.",
  "🌿 Jalan pagi melihat embun, semoga hati selalu tenang dan santun.",
  "☀️ Matahari terbit memberi cahaya, semoga lancar segala upaya.",
  "🌸 Bunga mekar di tepi taman, semoga hari ini penuh kenyamanan.",
  "🌊 Ombak tenang di laut biru, semoga rezeki datang bertemu.",
  "🍃 Angin sejuk berhembus pelan, semoga pekerjaan berjalan nyaman.",
  "🌙 Bulan bersinar ditemani bintang, semoga langkah hari ini semakin gemilang.",
  "🌱 Menanam benih dengan sabar, hasil baik akan datang menyebar.",
  "🕌 Awali hari dengan doa, semoga Allah menjaga setiap langkah kita.",
  "🤲 Niat baik membawa manfaat, kerja ikhlas membawa keberkahan.",
  "✨ Jangan lelah berbuat baik, karena kebaikan selalu menemukan jalannya.",
  "💙 Senyum sederhana bisa menjadi penyemangat bagi banyak orang.",
  "🌿 Setiap pelayanan yang tulus adalah bentuk amal yang bernilai.",
  "☀️ Hari baru adalah kesempatan baru untuk menjadi lebih baik."
];

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const getPeriod = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
};

const getTodayQuote = () => {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return dailyQuotes[dayOfYear % dailyQuotes.length];
};

const firstWord = (s) => (s || '').trim().split(/\s+/)[0] || '';

// Design size of the stage; it is scaled uniformly to fit the screen.
// Product name shown in the small label at the bottom left, for every clinic.
const BRAND = 'CLINARA';

const STAGE_W = 248;
const STAGE_H = 508;
const RING_LEN = 444;
const TOTAL_MS = 10000;
const FADE_MS = 500;

// Orbit text: whole phrases only, with letters at a readable spacing. A long role
// label drops the clinic name so the text never gets squeezed.
const buildRingText = (roleLabel, clinicName) => {
  const parts = [roleLabel, clinicName].filter(Boolean);
  const candidates = [];
  if (parts.length) candidates.push(parts.join(' \u00B7 ').toUpperCase() + ' \u00B7 ');
  if (roleLabel) candidates.push(roleLabel.toUpperCase() + ' \u00B7 ');
  if (!candidates.length) return '';
  let best = null;
  candidates.forEach((phrase) => {
    const reps = Math.max(1, Math.round(RING_LEN / (phrase.length * 6.3)));
    const perChar = RING_LEN / (reps * phrase.length);
    const ok = perChar >= 5.4 && perChar <= 8.2;
    const err = Math.abs(perChar - 6.4);
    if (!best || (ok && (!best.ok || err < best.err))) best = { phrase, reps, ok, err };
  });
  return best.phrase.repeat(best.reps);
};

export default function SplashScreen({ onDone }) {
  const { userDetails } = useAuth();
  const reduceMotion = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }, []);
  const userId = userDetails?.id;
  const clinicId = userDetails?.clinic_id;
  const userRole = userDetails?.role;
  const userAvatar = userDetails?.avatar_url;
  const [info, setInfo] = useState(null); // null until the lookups settle, then the timeline starts
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const onDoneRef = useRef(onDone);
  const finishedRef = useRef(false);
  const stageRef = useRef(null);
  const nameRef = useRef(null);
  const dotRef = useRef(null);
  const quoteRef = useRef(null);

  onDoneRef.current = onDone;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setVisible(false);
    onDoneRef.current?.();
  };

  // People who asked their device to reduce motion go straight in.
  useEffect(() => {
    if (reduceMotion) finish();
  }, [reduceMotion]);

  // One round of lookups (clinic, relawan, therapist photo). The timeline only starts once they settle,
  // so nothing re-renders mid-animation. A timeout keeps a slow network from holding the splash back.
  useEffect(() => {
    if (reduceMotion) return undefined;
    let active = true;
    const timeout = setTimeout(() => { if (active) setInfo((prev) => prev || { clinic: null, relawanNama: null, therapistAvatar: null }); }, 1200);

    const run = async () => {
      if (!userId) return;
      const out = { clinic: null, relawanNama: null, therapistAvatar: null };
      const tasks = [];
      if (clinicId) {
        tasks.push(supabase.from('clinics').select('name, logo_url, owner_role_label').eq('id', clinicId).single()
          .then(({ data }) => { out.clinic = data || null; }));
      }
      tasks.push(supabase.from('pemilih_relawan').select('nama').eq('user_id', userId).maybeSingle()
        .then(({ data }) => { out.relawanNama = data?.nama || null; }));
      if (userRole === 'therapist' && !userAvatar) {
        tasks.push(supabase.from('physiotherapists').select('avatar_url').eq('user_id', userId).maybeSingle()
          .then(({ data }) => { out.therapistAvatar = data?.avatar_url || null; }));
      }
      await Promise.race([Promise.allSettled(tasks), new Promise((resolve) => setTimeout(resolve, 900))]);
      if (active) setInfo({ ...out });
    };
    run();
    return () => { active = false; clearTimeout(timeout); };
  }, [userId, clinicId, userRole, userAvatar, reduceMotion]);

  const started = !!info;

  // Timeline: fade out for the last half second, done at 10s. Tap anywhere to skip.
  useEffect(() => {
    if (!started) return undefined;
    const fadeTimer = setTimeout(() => setFadeOut(true), TOTAL_MS - FADE_MS);
    const hideTimer = setTimeout(finish, TOTAL_MS);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, [started]);

  const skip = () => {
    if (finishedRef.current) return;
    setFadeOut(true);
    setTimeout(finish, 350);
  };

  const clinic = info?.clinic || null;
  const role = userDetails?.role;
  const roleLabel = info?.relawanNama ? 'Tim Pemenangan'
    : role === 'owner' ? (clinic?.owner_role_label || 'Pemilik Klinik')
    : role === 'admin' ? 'Admin'
    : role === 'therapist' ? 'Fisioterapis' : '';
  const name = firstWord(info?.relawanNama) || firstWord(userDetails?.full_name) || firstWord(userDetails?.name) || firstWord(roleLabel) || firstWord(clinic?.name) || BRAND;

  // Custom photo always wins; owners and admins fall back to the clinic logo, therapists to their own photo.
  const avatar = useMemo(() => {
    if (!info || avatarFailed) return null;
    if (userDetails?.avatar_url) return { src: userDetails.avatar_url, logo: false };
    if ((role === 'owner' || role === 'admin') && clinic?.logo_url) return { src: clinic.logo_url, logo: true };
    if (role === 'therapist' && info.therapistAvatar) return { src: info.therapistAvatar, logo: false };
    return null;
  }, [info, avatarFailed, userDetails?.avatar_url, role, clinic?.logo_url]);

  const period = useMemo(getPeriod, []);
  const quoteWords = useMemo(() => getTodayQuote().replace(/^[^A-Za-z0-9]+/, '').trim().split(/\s+/), []);
  const now = useMemo(() => {
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const minutes = d.getHours() * 60 + d.getMinutes();
    return { date: d.getDate(), weekday: DAYS[d.getDay()], month: MONTHS[d.getMonth()], clock: pad(d.getHours()) + ':' + pad(d.getMinutes()), frac: minutes / 1440 };
  }, []);
  const ringText = useMemo(() => buildRingText(roleLabel, clinic?.name), [roleLabel, clinic?.name]);

  // Fit the design to the screen, the name and quote to their space, and find the dot the bloom starts from.
  useLayoutEffect(() => {
    if (!started) return undefined;
    const layout = () => {
      const stage = stageRef.current, nm = nameRef.current, dot = dotRef.current, hl = quoteRef.current;
      if (!stage || !nm || !dot || !hl) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const k = Math.min(1.9, vw / STAGE_W, vh / STAGE_H);
      stage.style.setProperty('--sp-k', k.toFixed(4));
      stage.style.setProperty('--sp-bs', Math.ceil((Math.hypot(vw, vh) / k) * 2.4) + 'px');
      let fs = 76; nm.style.fontSize = fs + 'px';
      while (nm.scrollWidth > nm.clientWidth && fs > 22) { fs -= 1; nm.style.fontSize = fs + 'px'; }
      let qs = 28; hl.style.fontSize = qs + 'px';
      while (hl.offsetHeight > 170 && qs > 15) { qs -= 1; hl.style.fontSize = qs + 'px'; }
      const r = dot.getBoundingClientRect(), sr = stage.getBoundingClientRect(), kk = sr.width / STAGE_W || 1;
      stage.style.setProperty('--sp-fx', ((r.left + r.width / 2 - sr.left) / kk).toFixed(1) + 'px');
      stage.style.setProperty('--sp-fy', ((r.top + r.height / 2 - sr.top) / kk).toFixed(1) + 'px');
    };
    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, [started, name, quoteWords]);

  if (reduceMotion || !visible) return null;

  return (
    <div
      className="sp-root"
      style={{ background: SPLASH_BACKDROP, opacity: fadeOut ? 0 : 1 }}
      onClick={skip}
      role="status"
      aria-label="Memuat"
    >
      <style>{SPLASH_CSS}</style>
      {started && (
        <div
          ref={stageRef}
          className="sp-stage"
          style={{ '--sp-dn': now.date, '--sp-rn': Math.round(now.frac * 100) }}
        >
          {/* scene 2: avatar + daily quote */}
          <div className="sp-s2">
            <div className="sp-ava">
              {ringText && (
                <svg className="sp-ringtxt" viewBox="0 0 160 160" aria-hidden="true">
                  <defs><path id="sp-orbit" d="M80 80 m-71 0 a71 71 0 1 1 142 0 a71 71 0 1 1 -142 0" /></defs>
                  <text><textPath href="#sp-orbit" textLength={RING_LEN} lengthAdjust="spacing">{ringText}</textPath></text>
                </svg>
              )}
              <div className={`sp-disc${avatar?.logo ? ' sp-logo' : ''}`}>
                {avatar
                  ? <img src={avatar.src} alt="" decoding="async" onError={() => setAvatarFailed(true)} />
                  : name.charAt(0).toUpperCase()}
              </div>
            </div>
            {roleLabel && <div className="sp-tag2 sp-cap"><i className="sp-dotl" /><span>{roleLabel}</span></div>}
            <h2 ref={quoteRef} className="sp-hl sp-kw" style={{ '--sp-st': Math.min(0.11, 0.6 / Math.max(1, quoteWords.length - 1)).toFixed(3) + 's' }}>
              {quoteWords.map((w, j) => (
                <span key={j}>
                  <span className="sp-wm"><span className={`sp-w${j === quoteWords.length - 1 ? ' sp-ac' : ''}`} style={{ '--sp-j': j }}>{w}</span></span>{' '}
                </span>
              ))}
            </h2>
          </div>

          {/* scene 1: greeting, name, dot */}
          <div className="sp-s1">
            <p className="sp-hi">Selamat {period},</p>
            <h1 ref={nameRef} className="sp-nm">
              {name.split('').map((c, i) => <span key={i} className="sp-l" style={{ '--sp-i': i }}>{c}</span>)}
              <span ref={dotRef} className="sp-dt" />
            </h1>
            {roleLabel && <p className="sp-lab sp-cap"><i className="sp-dotl" /><span>{roleLabel}</span></p>}
          </div>

          {/* scene 3: today's numbers, from the device clock */}
          <div className="sp-s3">
            <div className="sp-tg3 sp-cap"><i className="sp-dotl" /><span>Hari ini</span></div>
            <div className="sp-dn" aria-label={'Tanggal ' + now.date} />
            <div className="sp-dm"><small>{now.weekday}</small><span>{now.month}</span></div>
            <div className="sp-rg3">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle className="sp-tr" cx="50" cy="50" r="42" />
                <circle className="sp-pr" pathLength="1" cx="50" cy="50" r="42" style={{ '--sp-off': (1 - now.frac).toFixed(3) }} />
              </svg>
              <b />
            </div>
            <div className="sp-rt3"><p>Hari ini sudah berjalan</p><strong>{now.clock}</strong></div>
          </div>

          <div className="sp-flood"><div className="sp-bl" /></div>
          <div className="sp-cnt"><span>{BRAND}</span><b className="sp-pc" /></div>
        </div>
      )}
    </div>
  );
}

const SPLASH_CSS = `
@property --sp-p { syntax: "<integer>"; inherits: true; initial-value: 100; }
@property --sp-dn { syntax: "<integer>"; inherits: true; initial-value: 14; }
@property --sp-rn { syntax: "<integer>"; inherits: true; initial-value: 41; }

/* Colour roles: --sp-acc accent, --sp-t1 main text, --sp-t2 supporting colour (greeting + labels), --sp-t3 quiet grey,
   --sp-ink text on the accent bloom, --sp-trk ring track on the bloom. */
.sp-root { --sp-acc: #8ec9ff; --sp-t1: #f3f8ff; --sp-t2: #ffc9a3; --sp-t3: #98a0aa; --sp-ink: #0a2540; --sp-trk: rgba(10,37,64,.2);
  --sp-bl1: #b5dcff; --sp-bl2: #8ec9ff; --sp-bl3: #6fb4f0;
  position: fixed; inset: 0; z-index: 999999; overflow: hidden; transition: opacity .5s ease; cursor: pointer; -webkit-tap-highlight-color: transparent; }
/* The stage is the 248 x 508 design, scaled uniformly to fit any screen. */
.sp-stage { --sp-p: 100; --sp-ax: 124px; --sp-ay: 176px; position: absolute; left: 50%; top: 50%; width: 248px; height: 508px; margin: -254px 0 0 -124px;
  transform: scale(var(--sp-k, 1)); transform-origin: center; color: var(--sp-t1); font-family: "Inter Tight", Inter, system-ui, sans-serif; }

.sp-dotl { width: 5px; height: 5px; border-radius: 50%; background: var(--sp-acc); flex: none; }
.sp-cap { display: flex; align-items: center; gap: 7px; font: 500 9.5px/1 "DM Sans", Inter, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--sp-t2); }
.sp-kw .sp-wm { display: inline-block; overflow: hidden; vertical-align: top; padding: 0 .04em .1em 0; margin-right: .22em; }
.sp-kw .sp-w { display: inline-block; }
.sp-kw .sp-ac { font: italic 400 1.2em/1 "Instrument Serif", Georgia, serif; letter-spacing: -.01em; padding-right: .06em; color: var(--sp-acc); }

/* scene 1: greeting, name, accent dot */
.sp-s1 { position: absolute; inset: 0; padding: 0 24px; display: flex; flex-direction: column; justify-content: center; visibility: hidden; z-index: 2; }
.sp-hi { margin: 0 0 8px; font: italic 400 21px/1 "Instrument Serif", Georgia, serif; color: var(--sp-t2); }
.sp-nm { margin: 0; overflow: hidden; padding: .04em 0 .1em; font-weight: 800; line-height: .95; text-transform: uppercase; letter-spacing: -.045em; white-space: nowrap; color: var(--sp-t1); }
.sp-nm .sp-l { display: inline-block; }
.sp-nm .sp-dt { display: inline-block; width: .5em; height: .5em; border-radius: 50%; background: var(--sp-acc); margin-left: .08em; }
.sp-lab { margin: 12px 0 0; }

/* bloom: a circle that grows from the dot, shrinks into the avatar, grows again and stays. Size is set to cover the screen. */
.sp-flood { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 5; transform: translate(var(--sp-ax), var(--sp-ay)); }
.sp-bl { position: absolute; left: calc(var(--sp-bs, 1600px) / -2); top: calc(var(--sp-bs, 1600px) / -2); width: var(--sp-bs, 1600px); height: var(--sp-bs, 1600px); border-radius: 50%; transform: scale(0);
  background: radial-gradient(circle 700px at 44% 42%, var(--sp-bl1) 0%, var(--sp-bl2) 55%, var(--sp-bl3) 100%); }

/* scene 2: avatar with ring + orbiting text, then the daily quote */
.sp-s2 { position: absolute; inset: 0; z-index: 2; }
.sp-ava { position: absolute; left: 50%; top: 96px; width: 160px; height: 160px; margin-left: -80px; }
.sp-ringtxt { position: absolute; inset: 0; width: 100%; height: 100%; }
.sp-ringtxt text { font: 500 7.8px "DM Sans", Inter, sans-serif; letter-spacing: .1em; text-transform: uppercase; fill: var(--sp-t3); }
.sp-disc { position: absolute; inset: 22px; border-radius: 50%; border: 3px solid var(--sp-acc); background: #121214; display: grid; place-items: center; overflow: hidden; font-size: 46px; font-weight: 800; color: var(--sp-t1); }
.sp-disc img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sp-disc.sp-logo { background: #fff; }
.sp-disc.sp-logo img { object-fit: contain; padding: 15%; }
.sp-tag2 { position: absolute; left: 24px; right: 20px; top: 278px; }
.sp-hl { position: absolute; left: 24px; right: 18px; top: 300px; margin: 0; font-size: 28px; font-weight: 800; line-height: 1.08; letter-spacing: -.035em; color: var(--sp-t1); --sp-t0: 4.3s; --sp-st: .11s; }

/* scene 3: numbers on the bloom */
.sp-s3 { position: absolute; inset: 0; z-index: 6; color: var(--sp-ink); visibility: hidden; }
.sp-s3 .sp-cap { color: var(--sp-ink); opacity: .8; } .sp-s3 .sp-dotl { background: var(--sp-ink); }
.sp-tg3 { position: absolute; left: 24px; top: 48px; }
.sp-dn { position: absolute; left: 18px; top: 62px; font-size: 138px; font-weight: 800; letter-spacing: -.07em; line-height: .9; }
.sp-dn::after { counter-reset: spd var(--sp-dn); content: counter(spd); font-variant-numeric: tabular-nums; }
.sp-dm { position: absolute; left: 24px; top: 202px; }
.sp-dm small { display: block; font: 500 10px/1 "DM Sans", Inter, sans-serif; letter-spacing: .2em; text-transform: uppercase; margin-bottom: 4px; }
.sp-dm span { font: italic 400 34px/1 "Instrument Serif", Georgia, serif; color: var(--sp-ink); }
.sp-rg3 { position: absolute; left: 24px; top: 300px; width: 96px; height: 96px; }
.sp-rg3 svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.sp-rg3 .sp-tr { fill: none; stroke: var(--sp-trk); stroke-width: 9; }
.sp-rg3 .sp-pr { fill: none; stroke: var(--sp-ink); stroke-width: 9; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: var(--sp-off, .6); }
.sp-rg3 b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 25px; font-weight: 800; letter-spacing: -.03em; }
.sp-rg3 b::after { counter-reset: spr var(--sp-rn); content: counter(spr) "%"; font-variant-numeric: tabular-nums; }
.sp-rt3 { position: absolute; left: 134px; right: 18px; top: 304px; }
.sp-rt3 p { margin: 0 0 8px; font: 500 12.5px/1.35 "Inter Tight", Inter, sans-serif; }
.sp-rt3 strong { font-size: 30px; font-weight: 800; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; color: var(--sp-ink); }

.sp-cnt { position: absolute; left: 24px; right: 24px; bottom: 22px; display: flex; justify-content: space-between; font: 500 9px/1 "DM Sans", Inter, sans-serif; letter-spacing: .2em; color: var(--sp-t3); z-index: 7; }
.sp-pc::after { counter-reset: spp var(--sp-p); content: counter(spp) "%"; font-variant-numeric: tabular-nums; }

/* motion: seconds on one 10s clock, long ease-out curves, nothing loops except the slow orbit text */
.sp-stage { animation: sp-pcount 10s linear both; }
.sp-cnt { animation: sp-cntc 10s step-end both; }
.sp-s1 { animation: sp-s1vis 3.2s linear both; }
.sp-s2 { animation: sp-s2vis 6.75s linear both; }
.sp-s3 { animation: sp-s3vis 10s linear both; }
.sp-hi { animation: sp-up .9s cubic-bezier(.22,1,.36,1) .1s both; }
.sp-nm .sp-l { animation: sp-rise 1s cubic-bezier(.22,1,.36,1) calc(.2s + var(--sp-i) * .085s) both; }
.sp-nm .sp-dt { animation: sp-dotpop .8s cubic-bezier(.34,1.2,.64,1) 1s both; }
.sp-lab { animation: sp-up .8s cubic-bezier(.22,1,.36,1) 1.3s both; }
.sp-flood { animation: sp-bmove 10s both; }
.sp-bl { animation: sp-bscale 10s both; }
.sp-ava { animation: sp-avapop .9s cubic-bezier(.34,1.15,.64,1) 3.8s both; }
.sp-ringtxt { animation: sp-ringin .9s ease-out 4s both, sp-spin 40s linear 4s infinite; }
.sp-tag2 { animation: sp-up .8s cubic-bezier(.22,1,.36,1) 4.1s both; }
.sp-hl .sp-w { animation: sp-rise .9s cubic-bezier(.22,1,.36,1) calc(var(--sp-t0) + var(--sp-j) * var(--sp-st)) both; }
.sp-hl .sp-ac { animation: sp-rise 1s cubic-bezier(.22,1,.36,1) calc(var(--sp-t0) + var(--sp-j) * var(--sp-st) + .08s) both; }
.sp-tg3 { animation: sp-up .8s cubic-bezier(.22,1,.36,1) 6.65s both; }
.sp-dn { animation: sp-dnrun 1.7s cubic-bezier(.16,1,.3,1) 6.75s both, sp-up .9s cubic-bezier(.22,1,.36,1) 6.75s both; }
.sp-dm { animation: sp-up .9s cubic-bezier(.22,1,.36,1) 7.05s both; }
.sp-rg3 { animation: sp-avapop .9s cubic-bezier(.34,1.15,.64,1) 7.2s both; }
.sp-rg3 .sp-pr { animation: sp-ringfill 1.9s cubic-bezier(.22,1,.36,1) 7.3s both; }
.sp-rg3 b { animation: sp-rnrun 1.9s cubic-bezier(.22,1,.36,1) 7.3s both; }
.sp-rt3 { animation: sp-up .9s cubic-bezier(.22,1,.36,1) 7.55s both; }

@keyframes sp-pcount { from { --sp-p: 0; } }
@keyframes sp-cntc { 0% { color: var(--sp-t3); } 62% { color: color-mix(in srgb, var(--sp-ink) 70%, transparent); } }
@keyframes sp-s1vis { from, 99% { visibility: visible; } to { visibility: hidden; } }
@keyframes sp-s2vis { 0%, 47% { visibility: hidden; } 47.1%, 99.9% { visibility: visible; } 100% { visibility: hidden; } }
@keyframes sp-s3vis { 0%, 66% { visibility: hidden; } 66.1%, 100% { visibility: visible; } }
@keyframes sp-up { from { opacity: 0; transform: translateY(14px); } }
@keyframes sp-rise { from { transform: translateY(112%); } }
@keyframes sp-dotpop { from { transform: scale(0); } }
@keyframes sp-bmove {
  0%, 32.5% { transform: translate(var(--sp-fx), var(--sp-fy)); animation-timing-function: cubic-bezier(.65,0,.35,1); }
  40.5%, 100% { transform: translate(var(--sp-ax), var(--sp-ay)); }
}
@keyframes sp-bscale {
  0%, 23% { transform: scale(0); animation-timing-function: cubic-bezier(.65,0,.35,1); }
  31%, 32.5% { transform: scale(1); animation-timing-function: cubic-bezier(.65,0,.35,1); }
  40.5%, 59% { transform: scale(0); animation-timing-function: cubic-bezier(.65,0,.35,1); }
  67%, 100% { transform: scale(1); }
}
@keyframes sp-avapop { from { opacity: 0; transform: scale(.6); } }
@keyframes sp-ringin { from { opacity: 0; } }
@keyframes sp-spin { to { transform: rotate(360deg); } }
@keyframes sp-dnrun { from { --sp-dn: 0; } }
@keyframes sp-rnrun { from { --sp-rn: 0; } }
@keyframes sp-ringfill { from { stroke-dashoffset: 1; } }
`;
