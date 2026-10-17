-- Portal pasien Clinara: perkembangan per diagnosa ("episode") dan riwayat diagnosa.
--
-- Terapis menjawab "Diagnosa masih sama dengan kunjungan terakhir?" di form SOAP. Jawaban itu sekarang
-- disimpan di medical_records.soap_continuation ('same' | 'different'):
--   * same      -> SOAP melanjutkan episode yang sama, progresnya tercatat di episode itu
--   * different -> episode baru (diagnosa lain, atau diagnosa sama di sisi lain); progres mulai dari awal
--   * null      -> data lama / tidak dijawab: episode baru dimulai bila set diagnosa rekap berubah
--
-- Onset keluhan dibaca dari Subjective ("sejak 3 minggu yang lalu") yang ditulis terapis pada SOAP pertama
-- episode itu, jadi tanggalnya perkiraan; portal menampilkannya sebagai durasi yang ikut bertambah.
-- Bila Subjective tidak memuatnya, dipakai complaint_onset_date dari rekam medis lengkap (tanggal pasti).
--
-- portal_get_progress: entri hanya dari episode berjalan, ditambah 'episode' dan 'history' (semua episode).
-- portal_get_goals: target terapi hanya dari episode berjalan.
-- Hanya menambah kolom dan membuat/mengganti fungsi; tidak ada data yang dihapus. Tubuh fungsi memakai $fn$.

alter table public.medical_records
  add column if not exists soap_continuation text check (soap_continuation in ('same', 'different'));

-- Label diagnosa sebuah rekap: id opsi diterjemahkan ke labelnya, teks bebas dipakai apa adanya,
-- isian kosong/sampah dibuang. Hasil terurut supaya bisa dibandingkan antar kunjungan.
create or replace function public.portal_diag_labels(p_diagnosis jsonb)
returns text[]
language sql stable security definer
set search_path = public
as $fn$
  select nullif(array(
    select x from (
      select distinct case
          when e ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (select o.label from public.operational_options o where o.id = e::uuid)
          else nullif(btrim(e), '') end as x
      from jsonb_array_elements_text(
             case when jsonb_typeof(p_diagnosis) = 'array' then p_diagnosis else '[]'::jsonb end) e) q
    where x ~ '[[:alnum:]]' order by x), '{}'::text[])
$fn$;

-- Perkiraan tanggal onset dari teks Subjective ("sejak 2 minggu yang lalu") pada tanggal catatan.
create or replace function public.portal_parse_onset(p_text text, p_ref date)
returns date
language sql immutable
set search_path = public
as $fn$
  select case when m is null then null else p_ref - (m[1]::int * case lower(m[2])
           when 'hari' then 1 when 'minggu' then 7 when 'bulan' then 30 else 365 end) end
  from (select regexp_match(p_text, 'sejak\s+(\d{1,3})\s*(hari|minggu|bulan|tahun)', 'i') as m) t
$fn$;

-- Setiap SOAP pasien beserta nomor episode diagnosanya (urut tanggal sesi).
create or replace function public.portal_patient_episodes(p_patient uuid)
returns table (record_id uuid, created_at timestamptz, session_date date, episode_no int, label text)
language sql stable security definer
set search_path = public
as $fn$
  with recs as (
    select mr.id, mr.created_at, coalesce(dr.recap_date, mr.created_at::date) as d,
           mr.soap_continuation as cont, public.portal_diag_labels(dr.diagnosis) as labels
    from public.medical_records mr
    left join public.daily_recaps dr on dr.id = mr.daily_recap_id
    where mr.patient_id = p_patient
  ), flagged as (
    select r.*, case
        when row_number() over w = 1 then 1
        when cont = 'different' then 1
        when cont = 'same' then 0
        when labels is not null and lag(labels) over w is not null and labels <> lag(labels) over w then 1
        else 0 end as is_new
    from recs r window w as (order by d, created_at)
  )
  select id, created_at, d, (sum(is_new) over (order by d, created_at))::int,
         array_to_string(labels, ', ')
  from flagged
$fn$;

-- Satu baris per episode diagnosa pasien.
create or replace function public.portal_diagnosis_episodes(p_patient uuid)
returns table (episode_no int, label text, started_on date, ended_on date, sessions int,
               onset_date date, onset_exact boolean, vas_first smallint, vas_last smallint, is_current boolean)
language sql stable security definer
set search_path = public
as $fn$
  with recs as (
    select e.*, mr.subjective, public.portal_extract_nprs(mr.objective) as vas,
           public.portal_parse_onset(mr.subjective, e.session_date) as onset
    from public.portal_patient_episodes(p_patient) e
    join public.medical_records mr on mr.id = e.record_id
  ), agg as (
    select r.episode_no,
           (array_agg(r.label order by r.session_date desc, r.created_at desc) filter (where r.label is not null))[1] as label,
           min(r.session_date) as started_on, max(r.session_date) as ended_on, count(*)::int as sessions,
           (array_agg(r.onset order by r.session_date, r.created_at) filter (where r.onset is not null))[1] as onset,
           (array_agg(r.vas order by r.session_date, r.created_at) filter (where r.vas is not null))[1] as vas_first,
           (array_agg(r.vas order by r.session_date desc, r.created_at desc) filter (where r.vas is not null))[1] as vas_last
    from recs r group by r.episode_no
  )
  select a.episode_no, a.label, a.started_on, a.ended_on, a.sessions,
         coalesce(a.onset, d.complaint_onset_date), a.onset is null and d.complaint_onset_date is not null,
         a.vas_first, a.vas_last, a.episode_no = max(a.episode_no) over ()
  from agg a
  left join lateral (
    select x.complaint_onset_date from public.medical_records_detailed x
    where x.patient_id = p_patient and x.complaint_onset_date is not null
      and x.record_date between a.started_on - 30 and a.ended_on
    order by x.record_date desc limit 1) d on true
  order by a.episode_no
$fn$;

-- Tab Progres: entri sesi dari episode berjalan saja, nomor sesi dihitung ulang per episode.
create or replace function public.portal_get_progress(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record; v_cur int;
begin
  select * into s from public.portal_resolve_session(p_session);
  select max(episode_no) into v_cur from public.portal_patient_episodes(s.patient_id);
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('no', n, 'date', d, 'vas', vas, 'update', upd) order by n)
      from (select row_number() over (order by e.session_date, e.created_at) as n,
                   e.session_date as d,
                   public.portal_extract_nprs(mr.objective) as vas,
                   public.portal_extract_update(mr.objective) as upd
            from public.portal_patient_episodes(s.patient_id) e
            join public.medical_records mr on mr.id = e.record_id
            where e.episode_no = v_cur) x), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
          'no', h.episode_no, 'label', h.label, 'started_on', h.started_on, 'ended_on', h.ended_on,
          'sessions', h.sessions, 'onset_date', h.onset_date, 'onset_exact', h.onset_exact,
          'vas_first', h.vas_first, 'vas_last', h.vas_last, 'is_current', h.is_current)
        order by h.episode_no desc)
      from public.portal_diagnosis_episodes(s.patient_id) h), '[]'::jsonb));
end
$fn$;

-- Target terapi: hanya dari SOAP di episode diagnosa berjalan.
create or replace function public.portal_get_goals(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record; v_goals jsonb; v_cur int;
begin
  select * into s from public.portal_resolve_session(p_session);
  select max(episode_no) into v_cur from public.portal_patient_episodes(s.patient_id);

  select mr.plan_data->'goals' into v_goals
    from public.medical_records mr
    join public.portal_patient_episodes(s.patient_id) e on e.record_id = mr.id
    where e.episode_no = v_cur
      and jsonb_typeof(mr.plan_data->'goals') = 'array'
      and jsonb_array_length(mr.plan_data->'goals') > 0
    order by mr.created_at desc limit 1;
  if v_goals is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', g.gid,
        'text', left(g.gtext, 300),
        'progress', g.prog,
        'history', coalesce((
          select jsonb_agg(jsonb_build_object('date', h.d, 'progress', h.p) order by h.d, h.ca)
          from (select mr.created_at::date as d, mr.created_at as ca,
                       least(100, greatest(0, (e->>'progress')::int)) as p
                from public.medical_records mr
                join public.portal_patient_episodes(s.patient_id) pe on pe.record_id = mr.id,
                     jsonb_array_elements(mr.plan_data->'goals') e
                where pe.episode_no = v_cur
                  and jsonb_typeof(mr.plan_data->'goals') = 'array'
                  and e->>'id' = g.gid
                  and (e->>'progress') ~ '^[0-9]{1,3}$') h), '[]'::jsonb))
      order by g.ord)
    from (select e->>'id' as gid, nullif(btrim(e->>'text'), '') as gtext,
                 case when (e->>'progress') ~ '^[0-9]{1,3}$'
                      then least(100, greatest(0, (e->>'progress')::int)) else 0 end as prog,
                 ord
          from jsonb_array_elements(v_goals) with ordinality as t(e, ord)
          where nullif(btrim(e->>'id'), '') is not null) g
    where g.gtext is not null), '[]'::jsonb);
end
$fn$;

-- Fungsi bantu hanya dipanggil dari fungsi portal lain (definer), tidak dibuka ke klien.
revoke all on function public.portal_diag_labels(jsonb), public.portal_parse_onset(text, date),
  public.portal_patient_episodes(uuid), public.portal_diagnosis_episodes(uuid) from public, anon, authenticated;
grant execute on function public.portal_get_progress(text), public.portal_get_goals(text) to anon;
