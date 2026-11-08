import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const getRecognitionCtor = () => (
  typeof window === 'undefined' ? null : (window.SpeechRecognition || window.webkitSpeechRecognition || null)
);

const joinText = (a, b) => (a.trim() ? `${a.replace(/\s+$/, '')} ${b}` : b);

// Dikte suara -> teks (Web Speech API, id-ID).
// Alur: tekan Dikte -> ucapan tampil di kotak preview (belum masuk ke kolom) -> dikte jalan terus
// sampai dimatikan manual -> setelah berhenti, preview bisa diedit lalu "Masukkan" atau "Buang".
// Tidak tampil bila browser tidak mendukung.
export default function VoiceDictationButton({ onAppend, disabled = false, label = 'Dikte' }) {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const wantRef = useRef(false); // true selama pengguna belum menekan Berhenti
  const Ctor = getRecognitionCtor();

  const killRec = () => {
    wantRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onend = null; try { rec.abort(); } catch { /* noop */ } }
  };

  useEffect(() => killRec, []);
  useEffect(() => { if (disabled && wantRef.current) stop(); }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!Ctor) return null;

  const begin = () => {
    const rec = new Ctor();
    rec.lang = 'id-ID';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interimText += t;
      }
      setInterim(interimText);
      if (finalText.trim()) setDraft((d) => joinText(d, finalText.trim()));
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantRef.current = false;
        toast({ variant: 'destructive', title: 'Mikrofon diblokir', description: 'Izinkan akses mikrofon di pengaturan browser.' });
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast({ variant: 'destructive', title: 'Dikte terputus', description: 'Mencoba menyambung lagi…' });
      }
    };
    // Browser mematikan sesi sendiri saat hening/jeda: sambung lagi selama belum dimatikan manual.
    rec.onend = () => {
      setInterim('');
      if (wantRef.current) {
        setTimeout(() => { if (wantRef.current) { try { begin(); } catch { /* noop */ } } }, 150);
      } else {
        recRef.current = null;
        setListening(false);
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch { /* sesi sebelumnya belum selesai; onend akan mencoba lagi */ }
  };

  const start = () => {
    setDraft('');
    setInterim('');
    wantRef.current = true;
    setListening(true);
    begin();
  };

  function stop() {
    wantRef.current = false;
    setListening(false);
    try { recRef.current?.stop(); } catch { /* noop */ }
  }

  const commit = () => {
    if (draft.trim()) onAppend(draft.trim());
    setDraft('');
    setInterim('');
  };
  const discard = () => { killRec(); setListening(false); setDraft(''); setInterim(''); };

  const showPreview = listening || draft.trim();

  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={disabled || (!listening && !!draft.trim())}
          aria-pressed={listening}
          className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            listening
              ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40 hover:bg-app-soft'
          }`}
        >
          {listening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
          {listening ? 'Matikan dikte' : label}
        </button>
        {listening && <span className="text-xs text-slate-500" aria-live="polite">Mendengarkan… tekan "Matikan dikte" bila selesai</span>}
      </div>

      {showPreview && (
        <div className="rounded-app border border-app-accent/30 bg-app-soft/40 p-2.5">
          <p className="mb-1 text-xs font-semibold text-slate-500">Preview (belum masuk ke kolom)</p>
          {listening ? (
            <p className="min-h-[2.5rem] whitespace-pre-wrap text-sm text-slate-800">
              {draft}{interim && <span className="text-slate-400">{draft ? ' ' : ''}{interim}</span>}
              {!draft && !interim && <span className="text-slate-400">Silakan bicara…</span>}
            </p>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-app-sm border border-slate-200 bg-white p-2 text-base focus:outline-none focus:ring-2 focus:ring-app-accent/40"
              aria-label="Preview hasil dikte, bisa diedit"
            />
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={discard} className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <X className="h-4 w-4" /> Buang
            </button>
            {!listening && (
              <button type="button" onClick={commit} disabled={!draft.trim()} className="inline-flex h-9 items-center gap-1 rounded-full bg-app-accent px-3 text-sm font-medium text-white hover:bg-app-accent-hover disabled:opacity-50">
                <Check className="h-4 w-4" /> Masukkan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
