import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends ComponentPropsWithRef<'button'> {
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'accent' | 'star';
  size?: 'md' | 'sm';
}

export function IconButton({ label, icon, tone = 'default', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  const cls = [styles.btn, tone !== 'default' ? styles[tone] : '', size === 'sm' ? styles.sm : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} aria-label={label} title={label} className={cls} {...rest}>
      {icon}
    </button>
  );
}
