import React from 'react';
import { cn } from '@/lib/utils';
import { nrsFromSubjective } from '@/lib/soapDictation';

const NRS_RE = /(^|\n)\*\*Skala Nyeri \(NRS\):\*\*[^\n]*/i;
const RED_RE = /(^|\n)\*\*Skrining red flag:\*\*[^\n]*/i;

// Pasang / ganti / hapus satu baris berlabel di Subjective. Teks lain tidak disentuh.
const setLine = (text, re, line) => {
  const base = String(text || '').replace(/\s+$/, '');
  if (!line) return base.replace(re, '').replace(/\n{3,}/g, '\n\n').trim();
  return re.test(base) ? base.replace(re, (_, lead) => `${lead}${line}`) : [base, line].filter(Boolean).join('\n');
};

const redState = (subjective) => {
  const m = RED_RE.exec(subjective || '');
  if (!m) return null;
  return /tidak ditemukan/i.test(m[0]) ? 'none' : 'ada';
};

const tone = (n) => (n <= 3 ? 'bg-[#1B7F52]' : n <= 6 ? 'bg-[#B86E00]' : 'bg-[#B03226]');

/**
 * NRS (0-10) dan skrining red flag dengan satu ketukan. Status dibaca dari teks Subjective,
 * jadi dikte, isian cepat, dan pemulihan draf selalu sejalan tanpa state tambahan.
 */
const SubjectiveQuickFields = ({ subjective, onChange, disabled = false }) => {
  const nrs = nrsFromSubjective(subjective);
  const red = redState(subjective);

  return (
    <div className="mb-3 space-y-4">
      <div>
        <div className="mb-1.5 text-xs font-bold tracking-wide text-[#546A72]">Nyeri hari ini (NRS)</div>
        <div className="grid grid-cols-11 gap-1" role="group" aria-label="Skala nyeri NRS">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-pressed={nrs === n}
              onClick={() => onChange(setLine(subjective, NRS_RE, nrs === n ? '' : `**Skala Nyeri (NRS):** ${n}/10.`))}
              className={cn(
                'h-11 rounded-lg border font-mono text-[13px] font-semibold tabular-nums transition-colors active:scale-[0.97]',
                nrs === n ? cn(tone(n), 'border-transparent text-white') : 'border-[#D5E1E2] bg-white text-slate-700 hover:border-app-accent/40'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-[#546A72]"><span>Tidak nyeri</span><span>Nyeri terberat</span></div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-bold tracking-wide text-[#546A72]">Skrining red flag</div>
        <div className="flex overflow-hidden rounded-[10px] border border-[#D5E1E2] bg-white">
          {[['none', 'Tidak ada', '**Skrining red flag:** tidak ditemukan.'], ['ada', 'Ada red flag', '**Skrining red flag:** ada, perlu dirinci.']].map(([key, label, line], i) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={red === key}
              onClick={() => onChange(setLine(subjective, RED_RE, red === key ? '' : line))}
              className={cn('min-h-[40px] flex-1 px-2.5 text-[13px] font-semibold', i > 0 && 'border-l border-[#D5E1E2]', red === key ? (key === 'ada' ? 'bg-[#B03226] text-white' : 'bg-app-accent text-white') : 'text-slate-700')}
            >
              {label}
            </button>
          ))}
        </div>
        {red === 'ada' && (
          <p className="mt-2 rounded-xl bg-[#FBE6E3] px-3 py-2 text-[13px] text-[#B03226]">
            <strong>Pertimbangkan rujukan.</strong> Rinci temuan di Subjective dan konsultasikan dengan dokter sebelum melanjutkan terapi.
          </p>
        )}
      </div>
    </div>
  );
};

export default SubjectiveQuickFields;
