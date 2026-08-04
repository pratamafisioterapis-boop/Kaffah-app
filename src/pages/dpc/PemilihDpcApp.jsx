import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllRows } from '@/lib/supabasePaginate';
import { PKS_ELECTION_YEARS } from '@/data/electionYears';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, LogOut, ListChecks, Table2 } from 'lucide-react';
import PemilihSuaraPksSetup from '../pemilih/PemilihSuaraPksSetup';
import PemilihDpcTpsInput from './PemilihDpcTpsInput';
import { PEMILIH_SHARED_CSS } from '../pemilih/pemilihSharedStyles';

const CSS = `
  ${PEMILIH_SHARED_CSS}
  :root { --d-red: #dc2626; --d-border: #e8e9ec; --d-text: #1a1d29; }
  .d-wrapper {
    min-height: 100vh; min-height: 100dvh; background: #f4f5f7; color: var(--d-text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }
  .d-topbar {
    position: sticky; top: 0; z-index: 20; background: linear-gradient(165deg, #17181f 0%, #0d0e13 100%);
    padding: 16px 18px; padding-top: calc(16px + env(safe-area-inset-top, 0));
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .d-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .d-brand-icon {
    width: 36px; height: 36px; border-radius: 11px; background: linear-gradient(135deg, #f97316, #ea580c);
    display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0;
  }
  .d-brand-text { font-weight: 800; font-size: 13.5px; color: #fff; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .d-brand-sub { font-size: 10.5px; color: #a1a1aa; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .d-logout {
    width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(248,113,113,0.25);
    background: rgba(248,113,113,0.08); color: #f87171; display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
  }
  .d-main { max-width: 900px; margin: 0 auto; padding: 22px 16px 48px; }
`;

const PemilihDpcApp = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [dpcNama, setDpcNama] = useState('');
  const [selectedDapil, setSelectedDapil] = useState('');
  const [dapilList, setDapilList] = useState([]);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [calegMasterRows, setCalegMasterRows] = useState([]);
  const [voteYears, setVoteYears] = useState([]);
  const [voteCandidateRows, setVoteCandidateRows] = useState([]);

  const fetchAll = React.useCallback(async () => {
    setLoading(true);
    const { data: dpc } = await supabase
      .from('pemilih_dpc')
      .select('nama, kecamatan_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!dpc) {
      setLoading(false);
      return;
    }
    setDpcNama(dpc.nama);
    setSelectedDapil(dpc.kecamatan_id);

    // pemilih_suara_caleg dipakai untuk menemukan tahun pemilu & nama caleg
    // yang sudah punya data suara (mis. dapil lama yang datanya diinput
    // sebelum fitur roster caleg ini ada, jadi belum tentu punya baris di
    // pemilih_caleg_master sama sekali). Tidak perlu filter kecamatan_id di
    // sini — RLS pemilih_suara_caleg_dpc_all sudah otomatis membatasi ke
    // kelurahan milik dapil akun ini.
    const [{ data: kec }, { data: kel }, { data: caleg }, { data: suara }] = await Promise.all([
      supabase.from('pemilih_kecamatan').select('id, nama').eq('id', dpc.kecamatan_id),
      supabase.from('pemilih_kelurahan').select('id, nama, kecamatan_id').eq('kecamatan_id', dpc.kecamatan_id).order('nama'),
      supabase.from('pemilih_caleg_master').select('id, kecamatan_id, election_year, candidate_number, candidate_name').eq('kecamatan_id', dpc.kecamatan_id).order('candidate_number'),
      fetchAllRows(() => supabase.from('pemilih_suara_caleg').select('election_year, candidate_number, candidate_name')),
    ]);
    setDapilList(kec || []);
    setKelurahanList(kel || []);
    setCalegMasterRows(caleg || []);
    setVoteYears(Array.from(new Set((suara || []).map((r) => r.election_year))).sort((a, b) => b - a));
    setVoteCandidateRows(suara || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Tahun pemilu terakhir yang punya data suara diutamakan (paling relevan
  // untuk dilihat/diedit); kalau belum ada data sama sekali, jatuh ke tahun
  // roster caleg terbaru; kalau roster juga masih kosong (dapil baru sama
  // sekali), pakai periode pemilu terbaru (PKS_ELECTION_YEARS) sebagai
  // titik awal — bukan tahun berjalan, karena itu bukan tahun pemilu.
  const defaultYear = voteYears.length > 0
    ? voteYears[0]
    : calegMasterRows.length > 0
      ? Math.max(...calegMasterRows.map((c) => c.election_year))
      : PKS_ELECTION_YEARS[0];

  return (
    <div className="d-wrapper">
      <style>{CSS}</style>
      <div className="d-topbar">
        <div className="d-brand">
          <div className="d-brand-icon">🗳️</div>
          <div style={{ minWidth: 0 }}>
            <div className="d-brand-text">Akun DPC — Suara PKS</div>
            <div className="d-brand-sub">{dpcNama || '...'}{dapilList[0]?.nama ? ` · ${dapilList[0].nama}` : ''}</div>
          </div>
        </div>
        <button className="d-logout" onClick={handleLogout} title="Keluar">
          <LogOut size={16} />
        </button>
      </div>

      <div className="d-main">
        {loading ? (
          <div style={{ padding: 80, textAlign: 'center' }}><Loader2 className="animate-spin" size={30} color="#ea580c" /></div>
        ) : !selectedDapil ? (
          <div className="p-card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
              Akun ini belum terhubung ke dapil manapun. Hubungi admin untuk mengatur ulang akun Anda.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1.5px solid var(--d-border)', paddingBottom: 12 }}>
              {[
                { key: 'setup', label: 'Setup Dapil', icon: ListChecks },
                { key: 'tps', label: 'Input Suara per TPS', icon: Table2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 16px', borderRadius: 11, border: '1.5px solid ' + (active ? '#ea580c' : 'var(--d-border)'),
                      background: active ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#fff',
                      color: active ? '#fff' : '#4b5563',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.16s',
                    }}
                  >
                    <Icon size={15} /> {t.label}
                  </button>
                );
              })}
            </div>

            {tab === 'setup' ? (
              <PemilihSuaraPksSetup
                manageDapil={false}
                dapilList={dapilList}
                selectedDapil={selectedDapil}
                onSelectDapil={() => {}}
                kelurahanList={kelurahanList}
                calegMasterRows={calegMasterRows}
                knownYears={voteYears}
                voteCandidateRows={voteCandidateRows}
                defaultYear={defaultYear}
                toast={toast}
                onChanged={fetchAll}
              />
            ) : (
              <PemilihDpcTpsInput
                selectedDapil={selectedDapil}
                kelurahanList={kelurahanList}
                calegMasterRows={calegMasterRows}
                knownYears={voteYears}
                defaultYear={defaultYear}
                toast={toast}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PemilihDpcApp;
