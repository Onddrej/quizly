import type { ReactNode } from 'react';
import styles from './TopBar.module.css';

interface TopBarProps {
  left?: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
}

export function TopBar({ left, title, right }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.side}>{left}</div>
      {title ? <h1 className={styles.title}>{title}</h1> : <span />}
      <div className={`${styles.side} ${styles.right}`}>{right}</div>
    </header>
  );
}
