import { useState } from "preact/hooks";
import { myStatus, type UserStatus } from "../../state";
import { setStatus } from "../../lib/actions";
import { Icon } from "../Icon";
import styles from "./StatusSelector.module.css";

export function StatusSelector() {
  const [statusText, setStatusText] = useState(myStatus.value.text || "");
  const [status, setStatusLocal] = useState(myStatus.value.status);
  const [saved, setSaved] = useState(false);

  const statusOptions: { value: UserStatus; label: string; color: string }[] = [
    { value: "online", label: "Online", color: "#23a55a" },
    { value: "idle", label: "Idle", color: "#f0b232" },
    { value: "dnd", label: "Do Not Disturb", color: "#f23f43" },
    { value: "offline", label: "Invisible", color: "#80848e" },
  ];

  const handleStatusChange = (newStatus: UserStatus) => {
    setStatusLocal(newStatus);
    setSaved(false);
  };

  const handleStatusTextChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setStatusText(target.value);
    setSaved(false);
  };

  const handleSave = () => {
    setStatus(status, statusText || undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.statusList}>
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            className={`${styles.statusBtn} ${status === opt.value ? styles.active : ""}`}
            onClick={() => handleStatusChange(opt.value)}
          >
            <span className={styles.statusDot} style={{ background: opt.color }} />
            <span className={styles.statusLabel}>{opt.label}</span>
            {status === opt.value && (
              <span className={styles.statusCheck}>
                <Icon name="Check" size={18} />
              </span>
            )}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={statusText}
        onInput={handleStatusTextChange}
        placeholder="What are you up to?"
        maxLength={100}
        className={styles.statusInput}
      />
      <div className={styles.footer}>
        <span className={`${styles.hint} ${saved ? styles.saved : ""}`}>
          {saved ? "Saved!" : "Status syncs to all servers that support it."}
        </span>
        <button className={styles.saveBtn} onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
