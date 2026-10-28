import styles from './Switch.module.css';

interface SwitchProps {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ id, label, checked, disabled, onChange }: SwitchProps) {
  return (
    <label htmlFor={id} className={styles.row}>
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className={styles.input} />
    </label>
  );
}
