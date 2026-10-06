import type { ComponentPropsWithRef, CSSProperties } from 'react';
import styles from './FieldArea.module.css';

interface FieldAreaProps extends ComponentPropsWithRef<'textarea'> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

/** Multi-line sibling of Field: same underline, label below, then an optional hint and error (both announced with the field). */
export function FieldArea({ id, label, hint, error, className, style, rows = 2, ...textarea }: FieldAreaProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <textarea
        id={id}
        rows={rows}
        style={{ '--field-rows': rows, ...style } as CSSProperties}
        className={`${styles.input} ${error ? styles.invalid : ''} ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...textarea}
      />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
