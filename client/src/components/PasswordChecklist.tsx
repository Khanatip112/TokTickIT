import React from "react";

/**
 * Live password-strength checklist (ui-spec.md §4.2).
 * Each rule transitions from a muted bullet to a green check as the user types.
 */
interface ChecklistRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: ChecklistRule[] = [
  {
    id: "length",
    label: "Be at least 8 characters",
    test: (pw) => pw.length >= 8,
  },
  {
    id: "case",
    label: "Include upper and lower case letters",
    test: (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw),
  },
  {
    id: "symbol",
    label: "Include a number and a special character",
    test: (pw) => /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw),
  },
];

/** Returns `true` when the candidate satisfies every complexity rule. */
export function passwordMeetsPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

interface PasswordChecklistProps {
  password: string;
  className?: string;
}

export const PasswordChecklist: React.FC<PasswordChecklistProps> = ({ password, className }) => {
  return (
    <div
      data-testid="password-checklist"
      className={className}
      style={{
        background: "#F6FAF8",
        border: "1px solid #E0ECE6",
        borderRadius: "0.5rem",
        padding: "12px",
      }}
    >
      <p className="fw-semibold small mb-2 text-secondary">Password must:</p>
      <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.id}
              data-testid={`password-rule-${rule.id}`}
              data-met={met}
              className="small d-flex align-items-center gap-2"
              style={{ color: met ? "#006B3C" : "#6C757D", fontWeight: met ? 600 : 400 }}
            >
              <span aria-hidden="true" style={{ width: "1rem", display: "inline-block" }}>
                {met ? "✔" : "•"}
              </span>
              <span>{rule.label}</span>
              <span className="visually-hidden">{met ? "met" : "not met"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
