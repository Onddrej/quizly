import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

/** Also used to style router <Link>s as buttons. */
export function buttonClassName(variant: ButtonVariant = 'primary', block = false, extra?: string): string {
  return [styles.btn, styles[variant], block ? styles.block : '', extra ?? ''].filter(Boolean).join(' ');
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', block = false, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClassName(variant, block, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}
