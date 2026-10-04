import React from "react";
import type { UserRole } from "../api.js";

/**
 * User role badges (ui-spec.md §3.3). Colors and labels are taken verbatim from
 * the Zen Green design system so the badge styling stays consistent app-wide.
 */
export const ROLE_BADGE: Record<UserRole, { label: string; bg: string; color: string; border: string }> = {
  REQUESTER: { label: "Requester", bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" },
  IT_STAFF: { label: "IT Staff", bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  ADMINISTRATOR: { label: "Administrator", bg: "#F3E8FF", color: "#6B21A8", border: "#DDD6FE" },
};

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className }) => {
  const badge = ROLE_BADGE[role] ?? ROLE_BADGE.REQUESTER;
  return (
    <span
      data-testid="role-badge"
      className={`badge rounded-pill ${className ?? ""}`.trim()}
      style={{
        backgroundColor: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "4px 10px",
      }}
    >
      {badge.label}
    </span>
  );
};
