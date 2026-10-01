import { NavLink } from 'react-router';
import { House, Plus, Settings } from 'lucide-react';
import styles from './TabBar.module.css';

const tabClass = ({ isActive }: { isActive: boolean }) => `${styles.tab} ${isActive ? styles.active : ''}`;

export function TabBar() {
  return (
    <nav className={styles.bar} aria-label="Main">
      <NavLink to="/" end className={tabClass}>
        <House size={22} />
        Home
      </NavLink>
      <NavLink to="/create" className={styles.create} aria-label="Create set">
        <span className={styles.plus}>
          <Plus size={22} />
        </span>
      </NavLink>
      <NavLink to="/settings" className={tabClass}>
        <Settings size={22} />
        Settings
      </NavLink>
    </nav>
  );
}
