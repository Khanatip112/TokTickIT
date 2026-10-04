import React from "react";

interface StatusBadgeProps {
  isActive: boolean;
  className?: string;
}

/**
 * Account activation badge (ui-spec.md §3.4).
 * Green pill for active accounts, red pill for deactivated accounts.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ isActive, className }) => {
  const palette = isActive
    ? { backgroundColor: "#EAF6EF", color: "#006B3C", border: "1px solid #A7F3D0" }
    : { backgroundColor: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5" };

  return (
    <span
      data-testid="status-badge"
      data-active={isActive}
      className={`badge rounded-pill ${className ?? ""}`.trim()}
      style={{ ...palette, fontSize: "0.72rem", fontWeight: 600, padding: "4px 10px" }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
};
