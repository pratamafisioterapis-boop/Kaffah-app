-- Bug: saat owner/admin membuat "login terapis" memakai email yang SAMA dengan
-- akun miliknya sendiri (mis. owner klinik yang mendaftar lewat link registrasi
-- lalu menambahkan dirinya sebagai terapis), create_auth_user_for_therapist
-- menemukan akun auth yang sudah ada lalu menimpa public.users.role menjadi
-- 'therapist'. Akibatnya owner kehilangan hak owner: get_my_role() = 'therapist'
-- dan RLS menolak simpan jadwal (therapist_slots) dengan error 42501.
--
-- Perbaikan: role hanya di-set 'therapist' bila akun belum punya role istimewa.
-- Owner / admin / super_admin tetap pada rolenya (tetap bisa tertaut ke profil
-- terapis lewat physiotherapists.user_id).

CREATE OR REPLACE FUNCTION public.create_auth_user_for_therapist(p_email text, p_password text, p_therapist_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_user_id uuid;
  v_clinic_id uuid;
  v_name text;
  v_phone text;
  v_caller_role text := get_my_role();
  v_caller_clinic_id uuid := get_my_clinic_id();
BEGIN
  SELECT clinic_id, name, phone INTO v_clinic_id, v_name, v_phone
  FROM physiotherapists WHERE id = p_therapist_id;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Therapist tidak ditemukan';
  END IF;

  IF NOT (
    v_caller_role = 'super_admin'
    OR (v_caller_role IN ('owner', 'admin') AND v_clinic_id = v_caller_clinic_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to create login for this therapist';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf', 10)),
      now(),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('role', 'therapist', 'full_name', coalesce(v_name, ''))
    );
  END IF;

  UPDATE physiotherapists
  SET user_id = v_user_id
  WHERE id = p_therapist_id;

  PERFORM set_config('app.trusted_role_change', 'on', true);

  -- Jangan menurunkan role akun yang sudah owner/admin/super_admin; akun milik
  -- klinik lain juga tidak boleh dipindah klinik.
  UPDATE public.users
  SET clinic_id = COALESCE(clinic_id, v_clinic_id),
      phone = COALESCE(phone, v_phone),
      role = CASE
               WHEN lower(coalesce(role, '')) IN ('owner', 'admin', 'clinic_admin', 'super_admin') THEN role
               ELSE 'therapist'
             END,
      is_active = true,
      updated_at = now()
  WHERE id = v_user_id;
END;
$function$;

-- Pulihkan akun yang sudah terlanjur diturunkan: owner klinik (clinics.owner_id)
-- yang rolenya jadi 'therapist' dikembalikan ke 'owner'.
DO $$
BEGIN
  PERFORM set_config('app.trusted_role_change', 'on', true);
  UPDATE public.users u
  SET role = 'owner', updated_at = now()
  FROM public.clinics c
  WHERE c.owner_id = u.id
    AND u.clinic_id = c.id
    AND lower(coalesce(u.role, '')) = 'therapist';
END $$;
