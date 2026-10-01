import { useEffect, useRef } from 'react';
import { Button } from './Button';
import styles from './InlineConfirm.module.css';

interface InlineConfirmProps {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-page confirmation; the artifact sandbox and good UX both rule out window.confirm(). Focus starts on the safe choice. */
export function InlineConfirm({ message, confirmLabel, cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }: InlineConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div className={styles.box} role="alertdialog" aria-label={message}>
      <p>{message}</p>
      <div className={styles.actions}>
        <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
