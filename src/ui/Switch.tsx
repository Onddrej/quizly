import styles from './Switch.module.css';

interface SwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ id, label, checked, onChange }: SwitchProps) {
  return (
    <label htmlFor={id} className={styles.row}>
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className={styles.input} />
    </label>
  );
}
