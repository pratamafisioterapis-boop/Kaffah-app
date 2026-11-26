import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

// Tampilan kuesioner feedback pasien (Kaffah & Praxis). Halaman dibuka pasien tanpa login dan
// SENGAJA tidak menampilkan nama pasien (identitas tetap tertaut di server lewat token link).
// Warna mengikuti kwitansi tiap klinik: Kaffah biru navy (#0a3d70), Praxis teal tua (#0f3d3e).

const THEMES = {
  kaffah: {
    brand: '#0A3D70', brandActive: '#072C52', accent: '#9FD5F3', page: '#EAF3FA', soft: '#E6F1F9',
    line: '#D4E6F3', ink: '#0F2236', muted: '#475B70', optionBorder: '#BCD3E6', dot: '#6B86A0', lead: '#D4E6F3',
  },
  praxis: {
    brand: '#0F3D3E', brandActive: '#0A2C2D', accent: '#8FD1C9', page: '#EAF4F3', soft: '#E3F1EF',
    line: '#CFE5E3', ink: '#0E2323', muted: '#46605F', optionBorder: '#B5D3D0', dot: '#6E8F8C', lead: '#CFE5E3',
  },
};
export const themeFor = (clinicId) => (clinicId === KAFFAH_CLINIC_ID ? THEMES.kaffah : THEMES.praxis);

const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Instrument Sans', system-ui, sans-serif";

// Font dimuat sekali; bila gagal dimuat, font cadangan sistem dipakai.
const useFeedbackFonts = () => {
  useEffect(() => {
    const id = 'feedback-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Instrument+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
};

export const QuestionnaireShell = ({ clinicId, children }) => {
  useFeedbackFonts();
  const t = themeFor(clinicId);
  return (
    <div style={{ minHeight: '100vh', background: t.page, color: t.ink, fontFamily: SANS }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>{children}</div>
    </div>
  );
};

const optionStyle = (t, on, grow) => ({
  display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 14px', boxSizing: 'border-box',
  borderRadius: 12, color: t.ink, fontSize: 16, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
  width: grow ? undefined : '100%', flex: grow ? '1 1 0' : undefined,
  border: on ? `1.5px solid ${t.brand}` : `1px solid ${t.optionBorder}`,
  background: on ? t.soft : '#fff', fontWeight: on ? 600 : 400,
});
const dotStyle = (t, on) => ({
  width: 20, height: 20, borderRadius: '50%', boxSizing: 'border-box', flex: 'none', background: '#fff',
  border: on ? `6px solid ${t.brand}` : `1.5px solid ${t.dot}`,
});

const Option = ({ t, on, label, onPick, grow, chip }) => (
  <button
    type="button"
    role="radio"
    aria-checked={on}
    onClick={onPick}
    style={{ ...optionStyle(t, on, grow), ...(chip ? { width: 'auto', flex: 'none', padding: '0 16px', minHeight: 48 } : null) }}
  >
    <span style={dotStyle(t, on)} />
    {label}
  </button>
);

const fieldStyle = (t) => ({
  width: '100%', boxSizing: 'border-box', border: `1px solid ${t.optionBorder}`, borderRadius: 12, background: '#fff',
  padding: '12px 14px', fontSize: 16, lineHeight: 1.45, color: t.ink, fontFamily: 'inherit',
});

const QuestionnaireForm = ({
  clinicId, clinicName, questions, staffNames, answers, setAnswers, onSubmit, submitting, googleNote,
}) => {
  useFeedbackFonts();
  const t = themeFor(clinicId);
  const [tried, setTried] = useState(false);
  const name = clinicName || 'klinik kami';
  const labelOf = (q) => q.label.replace('{clinic}', name);

  const required = useMemo(() => questions.filter((q) => q.required), [questions]);
  const isAnswered = (q) => (answers[q.id] || '').trim() !== '';
  const answeredCount = required.filter(isAnswered).length;
  const missing = required.length - answeredCount;
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));

  const handleSubmit = () => {
    if (missing > 0) {
      setTried(true);
      const first = required.find((q) => !isAnswered(q));
      if (first) document.getElementById(`card-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit();
  };

  return (
    <div>
      <div style={{
        position: 'sticky', top: 0, zIndex: 2, background: t.page, padding: '14px 20px 12px',
        borderBottom: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', gap: 8,
      }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.muted }}>
          <span style={{ fontWeight: 600, color: t.brand }}>{name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            <strong style={{ color: t.ink }}>{answeredCount}</strong> dari {required.length} wajib terjawab
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: t.line }}>
          <div style={{
            height: 6, borderRadius: 3, background: t.brand, transition: 'width .2s',
            width: `${required.length ? Math.round((answeredCount / required.length) * 100) : 100}%`,
          }}
          />
        </div>
      </div>

      <div style={{ padding: '26px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: t.brand, borderRadius: 22, padding: '26px 22px 24px', display: 'flex', flexDirection: 'column', gap: 12, color: '#fff',
        }}
        >
          {clinicId === KAFFAH_CLINIC_ID && (
            <img src="/kaffah-logo.png" alt={name} style={{ height: 44, width: 'auto', alignSelf: 'flex-start', objectFit: 'contain' }} />
          )}
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', color: t.accent, textTransform: 'uppercase' }}>{name}</div>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 32, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.015em', color: '#fff' }}>
            Bagaimana terapi Anda hari ini?
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: t.lead }}>
            {questions.length} pertanyaan singkat, sekitar 2 menit. Jawaban Anda menjadi dasar kami memperbaiki layanan.
          </p>
        </div>

        {tried && missing > 0 && (
          <div role="alert" style={{
            background: '#F6E3D8', border: '1px solid #B4532A', borderRadius: 12, padding: '12px 14px', fontSize: 15, lineHeight: 1.45, color: '#7A2E10',
          }}
          >
            Masih ada {missing} pertanyaan wajib yang belum dijawab.
          </div>
        )}

        {questions.map((q, i) => {
          const value = answers[q.id] || '';
          const bad = tried && q.required && !value.trim();
          const fieldId = `q-${q.id}`;
          const isTherapist = q.type === 'therapist';
          const choices = isTherapist ? [...staffNames, 'Semua baik'] : q.options;
          return (
            <div
              key={q.id}
              id={`card-${q.id}`}
              style={{
                background: '#fff', borderRadius: 18, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14,
                border: bad ? '1.5px solid #B4532A' : `1px solid ${t.line}`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.brand, fontVariantNumeric: 'tabular-nums' }}>{i + 1} dari {questions.length}</span>
                <label htmlFor={fieldId} style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.3, fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {labelOf(q)}{!q.required && <span style={{ fontFamily: SANS, fontSize: 14, color: t.muted }}> (opsional)</span>}
                </label>
              </div>

              {(q.type === 'choice' || isTherapist) && (
                <div
                  role="radiogroup"
                  aria-label={labelOf(q)}
                  style={{
                    display: 'flex', gap: 8,
                    flexDirection: isTherapist ? 'row' : (choices.length === 2 ? 'row' : 'column'),
                    flexWrap: isTherapist ? 'wrap' : 'nowrap',
                  }}
                >
                  {choices.map((opt) => {
                    const on = value === opt;
                    return (
                      <Option
                        key={opt}
                        t={t}
                        on={on}
                        label={opt}
                        grow={!isTherapist && choices.length === 2}
                        chip={isTherapist}
                        // Pertanyaan opsional: klik lagi untuk membatalkan pilihan.
                        onPick={() => set(q.id, on && !q.required ? '' : opt)}
                      />
                    );
                  })}
                </div>
              )}
              {q.type === 'text' && (
                <input id={fieldId} type="text" value={value} onChange={(e) => set(q.id, e.target.value)} style={{ ...fieldStyle(t), height: 52 }} />
              )}
              {q.type === 'textarea' && (
                <textarea id={fieldId} rows={4} value={value} onChange={(e) => set(q.id, e.target.value)} style={{ ...fieldStyle(t), height: 120, resize: 'none' }} />
              )}
              {bad && <span style={{ fontSize: 14, fontWeight: 600, color: '#9A3A12' }}>Mohon dijawab terlebih dahulu.</span>}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            marginTop: 6, height: 56, border: 0, borderRadius: 16, background: t.brand, color: '#fff', fontSize: 17, fontWeight: 600,
            cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit',
          }}
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Kirim jawaban
        </button>
        {googleNote && (
          <p style={{ margin: 0, textAlign: 'center', fontSize: 13, lineHeight: 1.5, color: t.muted }}>{googleNote}</p>
        )}
      </div>
    </div>
  );
};

// Pesan penutup / sudah diisi / tautan tidak berlaku, dengan tema yang sama.
export const QuestionnaireMessage = ({ clinicId, clinicName, kind }) => {
  const t = themeFor(clinicId);
  const name = clinicName || 'klinik kami';
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20, padding: '0 28px' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check color="#fff" size={28} strokeWidth={2.8} aria-hidden="true" />
      </div>
      {kind === 'already' ? (
        <>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 30, lineHeight: 1.12, fontWeight: 600, letterSpacing: '-0.015em' }}>Kuesioner ini sudah terisi.</h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: t.muted }}>Terima kasih, jawaban untuk link ini sudah kami terima sebelumnya.</p>
        </>
      ) : (
        <>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 32, lineHeight: 1.12, fontWeight: 600, letterSpacing: '-0.015em' }}>Terima kasih atas masukan Anda.</h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: t.muted }}>
            Terima kasih telah mempercayakan pemulihan Anda kepada <strong style={{ color: t.ink }}>{name}</strong>. Semoga lekas membaik dan sehat selalu.
          </p>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, fontWeight: 600 }}>Salam Sehat,<br />{name}</p>
        </>
      )}
    </div>
  );
};

export default QuestionnaireForm;
