-- Surat Peringatan (SP) untuk terapis yang melakukan pelanggaran, dibuat
-- oleh owner/admin klinik. Mengikuti pola therapist_mou_documents: draft
-- yang bisa diedit/diunduh sebagai PDF, lalu setelah dicetak & ditandatangani
-- terapis, owner mengunggah scan-nya sebagai bukti (status -> acknowledged)
-- supaya tampil di menu Dokumen milik terapis.
CREATE TABLE therapist_warning_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  physiotherapist_id uuid NOT NULL REFERENCES physiotherapists(id) ON DELETE CASCADE,
  letter_number text NOT NULL,
  level text NOT NULL DEFAULT 'SP1' CHECK (level IN ('SP1', 'SP2', 'SP3')),
  letter_date date NOT NULL,
  letter_city text NOT NULL DEFAULT 'Balikpapan',
  violation_date date NOT NULL,
  violation_description text NOT NULL,
  consequence_note text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'acknowledged')),
  signed_file_path text,
  signed_file_name text,
  signed_file_uploaded_at timestamptz,
  signed_file_uploaded_by uuid REFERENCES users(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_warning_letters_therapist ON therapist_warning_letters(physiotherapist_id);
CREATE INDEX idx_warning_letters_clinic ON therapist_warning_letters(clinic_id);

ALTER TABLE therapist_warning_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY warning_letter_owner_manage_own_clinic ON therapist_warning_letters
  FOR ALL
  USING (
    clinic_id IN (
      SELECT users.clinic_id FROM users
      WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner', 'admin', 'super_admin'])
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT users.clinic_id FROM users
      WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner', 'admin', 'super_admin'])
    )
  );

-- Terapis hanya boleh melihat surat yang sudah resmi diterbitkan (bukan draft
-- yang masih disiapkan owner).
CREATE POLICY warning_letter_therapist_select_own ON therapist_warning_letters
  FOR SELECT
  USING (
    status <> 'draft'
    AND physiotherapist_id IN (
      SELECT physiotherapists.id FROM physiotherapists WHERE physiotherapists.user_id = auth.uid()
    )
  );

-- Bucket privat (dokumen kepegawaian) — dibaca lewat signed URL, mengikuti
-- pola mou-documents.
INSERT INTO storage.buckets (id, name, public)
VALUES ('warning-letters', 'warning-letters', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY warning_letters_owner_manage ON storage.objects
  FOR ALL
  USING (bucket_id = 'warning-letters' AND get_my_role() = ANY (ARRAY['owner', 'admin', 'super_admin']))
  WITH CHECK (bucket_id = 'warning-letters' AND get_my_role() = ANY (ARRAY['owner', 'admin', 'super_admin']));

CREATE POLICY warning_letters_therapist_read_own ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'warning-letters'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT physiotherapists.id FROM physiotherapists WHERE physiotherapists.user_id = auth.uid()
    )
  );
