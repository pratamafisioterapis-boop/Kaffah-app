import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { subscribeConfirm } from '@/lib/confirmAction';

const DESTRUCTIVE = /hapus|delete|nonaktifkan|batalkan|peringatan/i;

// Mount once near the app root. Requests are queued, so two confirmations fired
// back to back are shown one after the other.
const ConfirmHost = () => {
  const [queue, setQueue] = useState([]);
  const current = queue[0];

  useEffect(() => subscribeConfirm((request) => setQueue((q) => [...q, request])), []);

  if (!current) return null;
  const { message, options } = current;
  // Radix also fires onOpenChange(false) after Cancel/Action clicks; only the first
  // settle for a given request counts, later ones find a different head and no-op.
  const settle = (value) =>
    setQueue((q) => {
      if (q[0] !== current) return q;
      current.resolve(value);
      return q.slice(1);
    });
  const destructive = options.destructive ?? DESTRUCTIVE.test(String(message));

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title || 'Konfirmasi'}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>{options.cancelLabel || 'Batal'}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
          >
            {options.confirmLabel || (destructive ? 'Ya, lanjutkan' : 'Lanjutkan')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmHost;
