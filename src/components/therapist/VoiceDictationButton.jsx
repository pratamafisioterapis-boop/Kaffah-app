import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const getRecognitionCtor = () => (
  typeof window === 'undefined' ? null : (window.SpeechRecognition || window.webkitSpeechRecognition || null)
);

// Dikte suara -> teks (Web Speech API, bahasa Indonesia). Teks final ditambahkan lewat onAppend.
// Tidak tampil bila browser tidak mendukung atau disabled.
export default function VoiceDictationButton({ onAppend, disabled = false, label = 'Dikte' }) {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const onAppendRef = useRef(onAppend);
  onAppendRef.current = onAppend;
  const Ctor = getRecognitionCtor();

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);
  useEffect(() => { if (disabled && recRef.current) { try { recRef.current.stop(); } catch { /* noop */ } } }, [disabled]);

  if (!Ctor) return null;

  const start = () => {
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
      if (finalText.trim()) onAppendRef.current(finalText.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast({ variant: 'destructive', title: 'Mikrofon diblokir', description: 'Izinkan akses mikrofon di pengaturan browser.' });
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast({ variant: 'destructive', title: 'Dikte gagal', description: 'Coba lagi atau ketik manual.' });
      }
    };
    rec.onend = () => { setListening(false); setInterim(''); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  const toggle = () => {
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } return; }
    start();
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          listening
            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40 hover:bg-app-soft'
        }`}
      >
        {listening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
        {listening ? 'Berhenti' : label}
      </button>
      {listening && (
        <span className="text-xs text-slate-500" aria-live="polite">
          {interim ? `… ${interim}` : 'Mendengarkan…'}
        </span>
      )}
    </div>
  );
}
