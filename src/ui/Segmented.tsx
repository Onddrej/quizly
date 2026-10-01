import styles from './Segmented.module.css';

interface SegmentedProps<T extends string> {
  name: string;
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ name, label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.track}>
        {options.map((option) => (
          <label key={option.value} className={`${styles.option} ${option.value === value ? styles.active : ''}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="visually-hidden"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
