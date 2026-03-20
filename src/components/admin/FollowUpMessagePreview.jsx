import React from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Send } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const FollowUpMessagePreview = ({ isOpen, onClose, message, onSend, sending, phoneNumber }) => {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    toast({ title: "Tersalin", description: "Pesan telah disalin ke clipboard." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preview Pesan WhatsApp</DialogTitle>
          <DialogDescription>
            Tinjau pesan sebelum dikirim ke nomor <strong>{phoneNumber}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm whitespace-pre-wrap font-sans leading-relaxed text-slate-800">
          {message}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            <Copy className="w-4 h-4" /> Salin Teks
          </Button>
          <Button onClick={onSend} disabled={sending} className="bg-green-600 hover:bg-green-700 gap-2">
            <Send className="w-4 h-4" /> {sending ? 'Mengirim...' : 'Kirim Sekarang'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpMessagePreview;