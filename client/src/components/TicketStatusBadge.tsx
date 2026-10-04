import React from "react";
import type { StaffTicketStatus } from "../api.js";

/**
 * Ticket status badges (ui-spec.md §3.1). Colors/labels are taken verbatim from
 * the Zen Green design system. `PENDING` is included as a DB-present fallback.
 */
const STATUS_BADGE: Record<StaffTicketStatus, { label: string; bg: string; color: string; border: string }> = {
  NEW: { label: "New", bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" },
  OPEN: { label: "Open", bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  IN_PROGRESS: { label: "In Progress", bg: "#EAF6EF", color: "#006B3C", border: "#A7F3D0" },
  PENDING: { label: "Pending", bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  WAITING_FOR_REQUESTER: { label: "Waiting for Requester", bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  RESOLVED: { label: "Resolved", bg: "#D1FAE5", color: "#047857", border: "#6EE7B7" },
  CLOSED: { label: "Closed", bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
  REOPENED: { label: "Reopened", bg: "#FFEDD5", color: "#C2410C", border: "#FDBA74" },
  CANCELLED: { label: "Cancelled", bg: "#FFE4E6", color: "#BE123C", border: "#FECDD3" },
};

interface TicketStatusBadgeProps {
  status: StaffTicketStatus;
  className?: string;
}

export const TicketStatusBadge: React.FC<TicketStatusBadgeProps> = ({ status, className }) => {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.NEW;
  return (
    <span
      data-testid="ticket-status-badge"
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

export const TICKET_STATUS_OPTIONS: { value: StaffTicketStatus; label: string }[] = (
  Object.keys(STATUS_BADGE) as StaffTicketStatus[]
).map((value) => ({ value, label: STATUS_BADGE[value].label }));