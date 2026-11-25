import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Dikte suara ke teks memakai pengenalan suara bawaan browser (gratis, tanpa AI berbayar).
// Tombol tidak tampil bila browser tidak mendukung (mis. Firefox).
const getRecognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

const DictationButton = ({ onText, disabled }) => {
  const { toast } = useToast();
  const Recognition = getRecognition();
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* sudah berhenti */ }
  }, []);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* abaikan */ } }, []);

  if (!Recognition) return null;

  const start = () => {
    const rec = new Recognition();
    rec.lang = 'id-ID';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      text = text.trim();
      if (text) onText(text);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast({ variant: 'destructive', title: 'Mikrofon tidak diizinkan', description: 'Izinkan akses mikrofon untuk situs ini di pengaturan browser.' });
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast({ variant: 'destructive', title: 'Dikte gagal', description: 'Coba lagi, atau ketik manual.' });
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  return (
    <Button
      type="button"
      variant={listening ? 'destructive' : 'outline'}
      size="sm"
      disabled={disabled}
      onClick={listening ? stop : start}
      aria-label={listening ? 'Hentikan dikte' : 'Mulai dikte suara'}
      className="shrink-0"
    >
      {listening ? <><Square className="mr-1 h-3.5 w-3.5" />Berhenti</> : <><Mic className="mr-1 h-4 w-4" />Dikte</>}
    </Button>
  );
};

export default DictationButton;
