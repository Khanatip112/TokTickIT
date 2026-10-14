import React, { ChangeEvent } from "react";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
}

/**
 * Password input with a visibility (show/hide) toggle and inline error text,
 * matching the Zen Green form conventions (ui-spec.md §2.2).
 */
export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  error,
  disabled,
  autoFocus,
  autoComplete = "off",
}) => {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label fw-semibold small">
        {label}
      </label>
      <div className="position-relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`form-control pe-5 ${error ? "is-invalid" : ""}`}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="btn btn-sm position-absolute top-50 end-0 translate-middle-y text-muted border-0"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          onClick={onToggle}
          disabled={disabled}
          tabIndex={-1}
        >
          {visible ? "🙈" : "👁"}
        </button>
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
};
