import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { fetchRecapQuote, fetchSoapFirstSettings, isSoapFirstActiveOn } from '@/lib/soapFirst';

// Pengaturan SOAP-first untuk klinik pengguna (null bila klinik tidak memakainya).
export const useSoapFirstSettings = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!clinicId) { setSettings(null); setLoaded(true); return; }
    const data = await fetchSoapFirstSettings();
    setSettings(data);
    setLoaded(true);
  }, [clinicId]);

  useEffect(() => { reload(); }, [reload]);

  return {
    settings,
    loaded,
    reload,
    isActiveOn: (isoDate) => isSoapFirstActiveOn(settings, isoDate),
  };
};

// Penawaran tagihan (tipe pasien, nominal, status kunci SOAP) dari server untuk satu recap.
export const useRecapQuote = (recapId, packageLabel, enabled) => {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !recapId) { setQuote(null); setError(null); return undefined; }
    let cancelled = false;
    setLoading(true);
    fetchRecapQuote(recapId, packageLabel)
      .then((q) => { if (!cancelled) { setQuote(q); setError(null); } })
      .catch((e) => { if (!cancelled) { setQuote(null); setError(e.message || 'Gagal memuat tagihan'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, recapId, packageLabel, nonce]);

  return { quote, loading, error, refresh };
};
