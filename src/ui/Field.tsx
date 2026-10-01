import type { ComponentPropsWithRef } from 'react';
import styles from './Field.module.css';

interface FieldProps extends ComponentPropsWithRef<'input'> {
  id: string;
  label: string;
  error?: string;
}

/** Quizlet-style underlined input with the label below it. */
export function Field({ id, label, error, className, ...input }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <input
        id={id}
        className={`${styles.input} ${error ? styles.invalid : ''} ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
