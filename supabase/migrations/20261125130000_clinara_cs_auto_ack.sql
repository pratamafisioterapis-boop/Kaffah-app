-- Balasan otomatis (tanpa AI) dalam bahasa awam begitu staf Praxis mengirim pesan pertama di sebuah tiket.
CREATE OR REPLACE FUNCTION public.clinara_cs_auto_ack()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind text; v_text text;
BEGIN
  IF NEW.sender <> 'staff' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.clinara_cs_messages WHERE ticket_id = NEW.ticket_id AND sender = 'cs') THEN RETURN NEW; END IF;
  SELECT kind INTO v_kind FROM public.clinara_cs_tickets WHERE id = NEW.ticket_id;
  v_text := CASE v_kind
    WHEN 'bug' THEN 'Terima kasih sudah melaporkan kendala ini. Laporan Anda sudah kami terima dan akan kami periksa. Mohon untuk sementara tidak mengubah atau mengisi ulang data yang bermasalah, supaya kami bisa menelusuri penyebabnya dengan tepat. Kami kabari di sini setiap ada perkembangan.'
    WHEN 'data' THEN 'Permintaan perbaikan data Anda sudah kami terima. Perubahan data hanya dilakukan setelah disetujui, dan setiap perubahan dicatat sehingga bisa dikembalikan bila diperlukan. Kami kabari di sini setelah selesai.'
    ELSE 'Terima kasih, permintaan Anda sudah kami terima dan akan kami tinjau. Kami kabari di sini setiap ada perkembangan.'
  END;
  INSERT INTO public.clinara_cs_messages (ticket_id, sender, body) VALUES (NEW.ticket_id, 'cs', v_text);
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.clinara_cs_auto_ack() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cs_auto_ack ON public.clinara_cs_messages;
CREATE TRIGGER trg_cs_auto_ack
AFTER INSERT ON public.clinara_cs_messages
FOR EACH ROW EXECUTE FUNCTION public.clinara_cs_auto_ack();
