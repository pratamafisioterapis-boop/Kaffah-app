-- Tabel bot balasan lama (wa_conversations, wa_messages; tanpa clinic_id, aktif
-- terakhir Maret 2026) punya policy "authenticated_only_*" yang mengizinkan
-- SEMUA operasi bagi siapa pun yang login, termasuk akun pasien portal dari
-- klinik mana pun: terbukti dengan simulasi (1.550 pesan + 37 percakapan terbaca,
-- dan bisa diubah/dihapus). Tidak ada kode aplikasi yang memakai tabel ini;
-- pemakainya bot di luar repo yang memakai service_role (melewati RLS).
--
-- Sekarang: hanya super_admin yang boleh MEMBACA; tidak ada tulis dari klien;
-- anon dicabut. Tidak ada data yang dihapus.
-- (Sudah dijalankan manual di produksi; file ini sebagai catatan di repo.)

DROP POLICY IF EXISTS authenticated_only_wa_conversations ON public.wa_conversations;
DROP POLICY IF EXISTS authenticated_only_wa_messages ON public.wa_messages;

CREATE POLICY super_admin_read_wa_conversations ON public.wa_conversations
  FOR SELECT TO authenticated
  USING (get_my_role() = 'super_admin');
CREATE POLICY super_admin_read_wa_messages ON public.wa_messages
  FOR SELECT TO authenticated
  USING (get_my_role() = 'super_admin');

REVOKE ALL ON public.wa_conversations, public.wa_messages FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.wa_conversations, public.wa_messages FROM authenticated;
