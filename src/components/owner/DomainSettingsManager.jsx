import React, { useEffect, useState } from 'react';
import { supabase, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Globe, CheckCircle2, AlertCircle, Clock, Trash2, RefreshCw } from 'lucide-react';

const APP_DOMAIN = 'clinara.id';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
const RESERVED = ['www', 'app', 'api', 'admin', 'super-admin', 'mail', 'ftp', 'clinara', 'kaffahphysio', 'staging', 'preview', 'dev', 'localhost', 'assets', 'cdn'];

const STATUS_BADGE = {
  none: { label: 'Belum terhubung', icon: Globe, className: 'text-slate-500 bg-slate-100' },
  pending: { label: 'Menunggu verifikasi DNS', icon: Clock, className: 'text-amber-700 bg-amber-100' },
  verified: { label: 'Terverifikasi', icon: CheckCircle2, className: 'text-green-700 bg-green-100' },
  failed: { label: 'Gagal', icon: AlertCircle, className: 'text-red-700 bg-red-100' },
};

const callDomainFn = async (payload) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const resp = await fetch(`${supabaseUrl}/functions/v1/manage-clinic-domain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return resp.json();
};

const DomainSettingsManager = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();

  const [clinic, setClinic] = useState(null);
  const [subdomain, setSubdomain] = useState('');
  const [savingSubdomain, setSavingSubdomain] = useState(false);

  const [domainInput, setDomainInput] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [verification, setVerification] = useState(null);

  const fetchClinic = async () => {
    if (!userDetails?.clinic_id) return;
    const { data } = await supabase
      .from('clinics')
      .select('id, subdomain, custom_domain, custom_domain_status, custom_domain_verified_at')
      .eq('id', userDetails.clinic_id)
      .single();
    if (data) {
      setClinic(data);
      setSubdomain(data.subdomain || '');
    }
  };

  useEffect(() => { fetchClinic(); }, [userDetails?.clinic_id]);

  const handleSaveSubdomain = async () => {
    const clean = subdomain.trim().toLowerCase();
    if (clean && !SUBDOMAIN_RE.test(clean)) {
      toast({ variant: 'destructive', title: 'Format tidak valid', description: 'Gunakan huruf kecil, angka, dan strip saja (3-63 karakter).' });
      return;
    }
    if (clean && RESERVED.includes(clean)) {
      toast({ variant: 'destructive', title: 'Subdomain tidak tersedia', description: 'Nama ini dipakai sistem, coba nama lain.' });
      return;
    }
    setSavingSubdomain(true);
    const { error } = await supabase.from('clinics').update({ subdomain: clean || null }).eq('id', clinic.id);
    setSavingSubdomain(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message.includes('duplicate') ? 'Subdomain ini sudah dipakai klinik lain.' : error.message });
    } else {
      toast({ title: 'Subdomain disimpan', description: clean ? `Situs klinik Anda: ${clean}.${APP_DOMAIN}` : 'Subdomain dihapus.' });
      fetchClinic();
    }
  };

  const handleRequestDomain = async () => {
    const clean = domainInput.trim().toLowerCase();
    if (!clean) return;
    setRequesting(true);
    const result = await callDomainFn({ action: 'request', clinic_id: clinic.id, domain: clean });
    setRequesting(false);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Gagal menghubungkan domain', description: result.error });
      return;
    }
    setVerification(result.verification);
    setDomainInput('');
    toast({ title: 'Domain ditambahkan', description: 'Ikuti instruksi DNS di bawah, lalu klik "Cek Status".' });
    fetchClinic();
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    const result = await callDomainFn({ action: 'check_status', clinic_id: clinic.id });
    setChecking(false);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Gagal mengecek status', description: result.error });
      return;
    }
    toast({
      title: result.status === 'verified' ? 'Domain terverifikasi!' : 'Masih menunggu',
      description: result.status === 'verified' ? 'Domain kustom Anda sudah aktif.' : 'DNS belum terdeteksi benar. Cek kembali beberapa menit lagi.',
    });
    fetchClinic();
  };

  const handleRemoveDomain = async () => {
    setRemoving(true);
    const result = await callDomainFn({ action: 'remove', clinic_id: clinic.id });
    setRemoving(false);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Gagal menghapus domain', description: result.error });
      return;
    }
    setVerification(null);
    toast({ title: 'Domain kustom dihapus' });
    fetchClinic();
  };

  if (!clinic) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>;
  }

  const badge = STATUS_BADGE[clinic.custom_domain_status] || STATUS_BADGE.none;
  const BadgeIcon = badge.icon;

  return (
    <div className="space-y-6">
      {/* Subdomain gratis */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">Subdomain Klinik</h2>
          <p className="text-sm text-slate-500">Alamat website gratis untuk klinik Anda di bawah {APP_DOMAIN}.</p>
        </div>
        <div className="p-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center flex-1 w-full border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
            <Input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              placeholder="nama-klinik-anda"
              className="border-0 focus-visible:ring-0 flex-1"
            />
            <span className="px-3 text-sm text-slate-400 bg-slate-50 h-full flex items-center whitespace-nowrap">.{APP_DOMAIN}</span>
          </div>
          <Button onClick={handleSaveSubdomain} disabled={savingSubdomain} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
            {savingSubdomain && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Simpan
          </Button>
        </div>
      </div>

      {/* Custom domain */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Domain Sendiri (Custom Domain)</h2>
            <p className="text-sm text-slate-500">Hubungkan domain milik klinik Anda sendiri, misal kliniksehat.com.</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
            <BadgeIcon className="w-3.5 h-3.5" /> {badge.label}
          </span>
        </div>

        <div className="p-6 space-y-4">
          {!clinic.custom_domain ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="kliniksehat.com"
                className="flex-1"
              />
              <Button onClick={handleRequestDomain} disabled={requesting || !domainInput.trim()} className="bg-blue-600 hover:bg-blue-700">
                {requesting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Hubungkan Domain
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50">
                <span className="font-medium text-slate-700">{clinic.custom_domain}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={checking}>
                    {checking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                    Cek Status
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRemoveDomain} disabled={removing} className="text-red-600 hover:bg-red-50">
                    {removing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                    Putuskan
                  </Button>
                </div>
              </div>

              {clinic.custom_domain_status !== 'verified' && (
                <div className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-2">
                  <p className="font-medium text-amber-800">Selesaikan setup DNS di penyedia domain Anda:</p>
                  <p>Tambahkan record berikut, lalu klik "Cek Status" (proses propagasi DNS bisa memakan waktu beberapa menit hingga beberapa jam):</p>
                  {verification && verification.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 font-mono text-xs">
                      {verification.map((v, i) => (
                        <li key={i}>{v.type} {v.domain || ''} → {v.value}</li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="list-disc list-inside space-y-1 font-mono text-xs">
                      <li>Domain root (contoh.com): A → 76.76.21.21</li>
                      <li>Subdomain (www.contoh.com): CNAME → cname.vercel-dns.com</li>
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DomainSettingsManager;
