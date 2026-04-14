import { Icon } from "../Icon";
import styles from "./Checkbox.module.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  icon?: string;
}

export function Checkbox({ checked, onChange, disabled, label, description, icon }: CheckboxProps) {
  const input = (
    <label className={`${styles.checkboxRoot}${disabled ? ` ${styles.disabled}` : ""}`}>
      <input
        type="checkbox"
        className={styles.checkboxInput}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
      <span className={styles.checkboxBox} aria-hidden="true" />
    </label>
  );

  if (!label) return input;

  return (
    <label className={styles.appearanceToggleRow}>
      {icon && (
        <span className={styles.appearanceToggleIcon}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <div className={styles.appearanceToggleText}>
        <div className={styles.appearanceToggleTitle}>{label}</div>
        {description && <div className={styles.appearanceToggleDesc}>{description}</div>}
      </div>
      {input}
    </label>
  );
}
