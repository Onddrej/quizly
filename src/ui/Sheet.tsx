import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import styles from './Sheet.module.css';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet for secondary options. Escape or a tap on the backdrop closes it. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2>{title}</h2>
          <IconButton label="Close" icon={<X size={20} />} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
