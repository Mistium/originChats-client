import { useEffect, useRef, useCallback } from "preact/hooks";
import type { SlashCommand } from "../../types";
import { Icon } from "../Icon";

export interface SlashCommandArgs {
  [optionName: string]: string;
}

interface SlashCommandInputProps {
  command: SlashCommand;
  args: SlashCommandArgs;
  onArgsChange: (args: SlashCommandArgs) => void;
  onSubmit: () => void;
  onDismiss: () => void;
}

export function SlashCommandInput({
  command,
  args,
  onArgsChange,
  onSubmit,
  onDismiss,
}: SlashCommandInputProps) {
  // Track which field index should be focused on mount / after changes
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Focus the first arg input (or the wrapper for arg-less commands) on mount
  useEffect(() => {
    if (command.options.length > 0) {
      firstFieldRef.current?.focus();
    } else {
      wrapperRef.current?.focus();
    }
  }, [command.name]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
      // Enter on the last field (or a command with no options) submits
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onDismiss, onSubmit]
  );

  const setArg = (name: string, value: string) => {
    onArgsChange({ ...args, [name]: value });
  };

  // Commands with no options just show the badge + submit / dismiss
  const hasOptions = command.options.length > 0;

  return (
    <div
      className="slash-cmd-input-wrapper"
      onKeyDown={handleKeyDown as any}
      ref={wrapperRef}
      tabIndex={command.options.length === 0 ? 0 : undefined}
    >
      {/* Left section: uneditable command badge */}
      <div className="slash-cmd-badge">
        <span className="slash-cmd-slash">/</span>
        <span className="slash-cmd-name">{command.name}</span>
      </div>

      {/* Middle section: per-option inputs */}
      {hasOptions ? (
        <div className="slash-cmd-args">
          {command.options.map((opt, i) => {
            const isFirst = i === 0;
            const placeholder = opt.required ? opt.description : `${opt.description} (optional)`;

            if (opt.type === "enum" && opt.choices && opt.choices.length > 0) {
              return (
                <div key={opt.name} className="slash-cmd-arg">
                  <label className="slash-cmd-arg-label">{opt.name}</label>
                  <select
                    className="slash-cmd-arg-select"
                    value={args[opt.name] ?? ""}
                    ref={
                      isFirst
                        ? (el) => {
                            firstFieldRef.current = el as any;
                          }
                        : undefined
                    }
                    onChange={(e) => setArg(opt.name, (e.target as HTMLSelectElement).value)}
                  >
                    {!opt.required && <option value="">—</option>}
                    {opt.choices.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div key={opt.name} className="slash-cmd-arg">
                <label className="slash-cmd-arg-label">{opt.name}</label>
                <input
                  type={opt.type === "int" || opt.type === "float" ? "number" : "text"}
                  className="slash-cmd-arg-input"
                  placeholder={placeholder}
                  value={args[opt.name] ?? ""}
                  ref={
                    isFirst
                      ? (el) => {
                          firstFieldRef.current = el;
                        }
                      : undefined
                  }
                  onInput={(e) => setArg(opt.name, (e.target as HTMLInputElement).value)}
                  step={opt.type === "float" ? "any" : undefined}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <span className="slash-cmd-no-args">Press Enter to run</span>
      )}

      {/* Right section: dismiss (X) button */}
      <button
        className="slash-cmd-dismiss icon-btn"
        title="Cancel (Escape)"
        onClick={onDismiss}
        type="button"
      >
        <Icon name="X" size={16} />
      </button>

      {/* Send button */}
      <button className="send-btn" onClick={onSubmit} type="button">
        <Icon name="Send" />
      </button>
    </div>
  );
}
