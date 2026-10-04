import React from "react";
import type { TicketPriority } from "../api.js";

/**
 * Priority badges for Requested Priority and IT Priority (ui-spec.md §3.2).
 * Colors/labels are taken verbatim from the Zen Green design system.
 */
const PRIORITY_BADGE: Record<TicketPriority, { label: string; bg: string; color: string; border: string }> = {
  LOW: { label: "Low", bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  MEDIUM: { label: "Medium", bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  HIGH: { label: "High", bg: "#FFEDD5", color: "#C2410C", border: "#FDBA74" },
  URGENT: { label: "Urgent", bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5" },
};

interface PriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const badge = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.MEDIUM;
  return (
    <span
      data-testid="priority-badge"
      className={`badge rounded-pill ${className ?? ""}`.trim()}
      style={{
        backgroundColor: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "4px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {badge.label}
    </span>
  );
};

export const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = (
  Object.keys(PRIORITY_BADGE) as TicketPriority[]
).map((value) => ({ value, label: PRIORITY_BADGE[value].label }));