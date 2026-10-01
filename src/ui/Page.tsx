import type { ReactNode } from 'react';
import styles from './Page.module.css';

interface PageProps {
  top?: ReactNode;
  bottom?: ReactNode;
  children: ReactNode;
}

/** Full-height screen: fixed top bar, scrolling body, optional bottom area (tab bar, actions, feedback). */
export function Page({ top, bottom, children }: PageProps) {
  return (
    <div className={styles.page}>
      {top}
      <main className={styles.body}>{children}</main>
      {bottom}
    </div>
  );
}
