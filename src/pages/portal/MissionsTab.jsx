import React, { useRef, useState } from 'react';
import { Check, Clock, ExternalLink, Gift, Lock, Star, Instagram, Camera, Users, XCircle } from 'lucide-react';
import { portalApi } from '@/lib/patientPortal';

// Tab "Misi" di portal pasien: checklist misi apresiasi pasien Kaffah.
// Bukti berupa tangkapan layar yang diverifikasi staf. Ulasan Google: rating apa pun, tulis jujur.
// Skema: supabase/migrations/20261102100000_kaffah_misi_loyalty.sql

const TOP_PAD = 'calc(env(safe-area-inset-top, 0px) + 28px)';

const handleOf = (loyalty) => (loyalty.instagram_handle || '').replace(/^@/, '');

const buildMissions = (loyalty) => {
  const handle = handleOf(loyalty);
  const at = handle ? `@${handle}` : 'Instagram kami';
  return [
    {
      type: 'google_review', Icon: Star, title: 'Beri ulasan di Google',
      desc: 'Ceritakan pengalaman terapi Anda dengan jujur, apa pun penilaiannya. Lalu unggah tangkapan layar ulasan Anda.',
      cta: 'Buka halaman ulasan Google', url: loyalty.google_review_url,
    },
    {
      type: 'ig_follow', Icon: Instagram, title: `Ikuti ${at}`,
      desc: 'Ikuti akun Instagram Kaffah, lalu unggah tangkapan layar yang menunjukkan tombol "Mengikuti".',
      cta: 'Buka Instagram Kaffah', url: loyalty.instagram_url,
    },
    {
      type: 'ig_story_tag', Icon: Camera, title: 'Unggah story & tag Kaffah',
      desc: `Bagikan momen terapi Anda di Instagram Story dan tag ${at}. Unggah tangkapan layar story-nya sebelum 24 jam berakhir.`,
      cta: null, url: null,
    },
  ];
};

const StatusPill = ({ status }) => {
  if (status === 'approved') return <span className="pill ok"><Check size={13} aria-hidden="true" /> Selesai</span>;
  if (status === 'pending') return <span className="pill warm"><Clock size={13} aria-hidden="true" /> Menunggu verifikasi</span>;
  if (status === 'rejected') return <span className="pill warm"><XCircle size={13} aria-hidden="true" /> Perlu diulang</span>;
  return null;
};

const MissionCard = ({ mission, state, busy, onPick }) => {
  const inputRef = useRef(null);
  const { Icon } = mission;
  const status = state?.status;
  const canSubmit = !status || status === 'rejected';
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="done-mark" style={{ width: 44, height: 44, flex: 'none', margin: 0 }}><Icon size={22} aria-hidden="true" /></span>
        <div className="sp" style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{mission.title}</h3>
          <div style={{ marginTop: 6 }}><StatusPill status={status} /></div>
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>{mission.desc}</p>
      {status === 'rejected' && state.reject_reason && (
        <p style={{ margin: 0, color: 'var(--bad)' }}>Alasan dari klinik: {state.reject_reason}</p>
      )}
      {canSubmit && (
        <>
          {mission.url && (
            <a className="btn ghost" href={mission.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={18} aria-hidden="true" /> {mission.cta}
            </a>
          )}
          <input ref={inputRef} type="file" accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(mission.type, f); }} />
          <button className="btn" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Camera size={18} aria-hidden="true" /> {busy ? 'Mengirim...' : status === 'rejected' ? 'Unggah ulang tangkapan layar' : 'Unggah tangkapan layar'}
          </button>
        </>
      )}
    </section>
  );
};

const MissionsTab = ({ session, loyalty, onChanged, onUnauthorized, flash }) => {
  const [busyType, setBusyType] = useState(null);
  const missions = buildMissions(loyalty);
  const byType = Object.fromEntries((loyalty.missions || []).map((m) => [m.type, m]));
  const done = missions.filter((m) => byType[m.type]?.status === 'approved').length;

  const pick = async (type, file) => {
    setBusyType(type);
    try {
      await portalApi.loyaltyProof(session, type, file);
      flash('Bukti terkirim. Klinik akan memverifikasi.');
      await onChanged();
    } catch (e) {
      if (e.sessionInvalid) onUnauthorized(); else flash(e.message || 'Gagal mengirim bukti.');
    } finally { setBusyType(null); }
  };

  return (
    <div className="pp-pad" style={{ paddingTop: TOP_PAD }}>
      <div className="page-head">
        <h2>Misi Kaffah</h2>
        <p className="muted">Selesaikan misi berikut sebagai apresiasi atas kepercayaan Anda kepada Kaffah.</p>
      </div>
      <section className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="done-mark" style={{ width: 44, height: 44, flex: 'none', margin: 0 }}><Gift size={22} aria-hidden="true" /></span>
        <div className="sp">
          <b className="num">{done} dari {missions.length + 1} misi selesai</b>
          <p className="muted small" style={{ margin: '2px 0 0' }}>Selesaikan semua misi untuk mendapatkan hadiah apresiasi dari Kaffah.</p>
        </div>
      </section>
      <div className="pair">
        {missions.map((m) => (
          <MissionCard key={m.type} mission={m} state={byType[m.type]} busy={busyType === m.type} onPick={pick} />
        ))}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.85 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <span className="done-mark" style={{ width: 44, height: 44, flex: 'none', margin: 0 }}><Users size={22} aria-hidden="true" /></span>
            <div className="sp">
              <h3 style={{ margin: 0 }}>Ajak keluarga & teman</h3>
              <div style={{ marginTop: 6 }}><span className="pill"><Lock size={13} aria-hidden="true" /> Segera hadir</span></div>
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>Rekomendasikan Kaffah kepada lebih dari 3 orang. Kode ajakan Anda akan muncul di sini.</p>
        </section>
      </div>
    </div>
  );
};

export default MissionsTab;
