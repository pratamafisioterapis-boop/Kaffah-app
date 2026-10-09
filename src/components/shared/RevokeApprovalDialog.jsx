import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

// Dialog konfirmasi pembatalan persetujuan (owner). Dipakai tukar shift & tukar Minggu.
const RevokeApprovalDialog = ({ open, title, description, note, onNoteChange, busy, onConfirm, onClose }) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <Textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Alasan pembatalan (opsional)"
        className="resize-none h-24"
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Kembali</Button>
        <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={busy} onClick={onConfirm}>
          {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          Ya, Batalkan
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default RevokeApprovalDialog;
