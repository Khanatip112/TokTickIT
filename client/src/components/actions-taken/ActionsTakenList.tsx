import React from "react";
import { ActionTaken } from "../../api.js";

interface ActionsTakenListProps {
  /** The list of action-taken records to display. */
  actions?: ActionTaken[];
  /** When provided, Edit buttons are rendered for IT Staff / Admin. */
  onEdit?: (action: ActionTaken) => void;
  /** Loading state — shows skeleton placeholders. */
  isLoading?: boolean;
  /** Error message to surface at the top of the section. */
  error?: string | null;
}

/** Formats an ISO datetime string into a human-readable locale string. */
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * ActionsTakenList — Lab 4 Issue 4
 *
 * Displays a chronological list of action-taken records associated with a
 * ticket. The `onEdit` prop gates the edit controls: when absent (Requester
 * view) all edit affordances are hidden.
 *
 * Responsive:
 *  - ≥768 px: structured card with two-column detail grid.
 *  - <768 px: single-column stacked card (no horizontal scroll).
 */
export const ActionsTakenList: React.FC<ActionsTakenListProps> = ({
  actions,
  onEdit,
  isLoading = false,
  error = null,
}) => {
  const actionsTaken = actions ?? [];

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div data-testid="actions-taken-loading" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="card mb-3 p-3 border"
            style={{
              borderColor: "var(--zen-border)",
              borderRadius: "var(--zen-radius-sm)",
            }}
          >
            <div className="zen-skeleton mb-2" style={{ height: 14, width: "40%", borderRadius: 4 }} />
            <div className="zen-skeleton mb-2" style={{ height: 14, borderRadius: 4 }} />
            <div className="zen-skeleton" style={{ height: 14, width: "60%", borderRadius: 4 }} />
          </div>
        ))}
      </div>
    );
  }

  // ── Error banner ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="alert alert-danger py-2 small" data-testid="actions-taken-error">
        {error}
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (actionsTaken.length === 0) {
    return (
      <p
        className="text-muted small mb-0 border p-3 rounded bg-light"
        data-testid="actions-taken-empty"
      >
        No actions taken recorded yet (no actions have been logged for this ticket).
      </p>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="d-flex flex-column gap-3 overflow-x-hidden"
      data-testid="actions-taken-list"
      style={{ overflowX: "hidden" }}
    >
      {actionsTaken.map((action, index) => (
        <div
          key={action.id}
          className="card border p-0"
          data-testid={`action-item-${action.id}`}
          style={{
            borderColor: "var(--zen-border)",
            borderRadius: "var(--zen-radius-sm)",
            overflow: "hidden",
          }}
        >
          {/* Card header — date/time + badge + edit button */}
          <div
            className="d-flex align-items-center justify-content-between px-3 py-2 flex-wrap gap-2"
            style={{ backgroundColor: "var(--zen-pale)", borderBottom: "1px solid var(--zen-border)" }}
          >
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span
                className="badge"
                style={{
                  backgroundColor: "var(--zen-primary)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  letterSpacing: "0.04em",
                }}
              >
                #{index + 1}
              </span>
              <span className="small fw-semibold" style={{ color: "var(--zen-primary)" }}>
                🕐 {formatDateTime(action.actionDateTime)}
              </span>
              {action.followUpRequired && (
                <span
                  className="badge"
                  style={{
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    border: "1px solid #F59E0B",
                    fontSize: "0.7rem",
                  }}
                >
                  ⚠️ Follow-Up Required
                </span>
              )}
            </div>
            {onEdit && (
              <button
                type="button"
                className="btn btn-zen-outline btn-sm"
                data-testid={`edit-action-${action.id}`}
                onClick={() => onEdit(action)}
                style={{ fontSize: "0.78rem" }}
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {/* Card body */}
          <div className="px-3 py-3">
            {/* Row 1: Description + Result */}
            <div className="row g-3 mb-2">
              <div className="col-12 col-md-6">
                <p className="text-muted small mb-1 fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.06em" }}>
                  Description
                </p>
                <p className="mb-0 text-dark small" style={{ whiteSpace: "pre-wrap" }}>
                  {action.description}
                </p>
              </div>
              <div className="col-12 col-md-6">
                <p className="text-muted small mb-1 fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.06em" }}>
                  Result / Outcome
                </p>
                <p className="mb-0 text-dark small" style={{ whiteSpace: "pre-wrap" }}>
                  {action.result}
                </p>
              </div>
            </div>

            {/* Row 2: Performed By + Follow-Up Note */}
            <div className="row g-3 mb-2">
              <div className="col-12 col-md-6">
                <p className="text-muted small mb-1 fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.06em" }}>
                  Performed By
                </p>
                <p className="mb-0 text-dark small">
                  {action.performedBy
                    ? `${action.performedBy.name || action.performedBy.fullName || "Staff"}${
                        action.performedBy.email || action.performedBy.role
                          ? ` (${action.performedBy.email || action.performedBy.role})`
                          : ""
                      }`
                    : action.performedById}
                </p>
              </div>
              {action.followUpRequired && (
                <div className="col-12 col-md-6">
                  <p className="text-muted small mb-1 fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.06em" }}>
                    Follow-Up Note
                  </p>
                  <div
                    className="p-2 rounded small"
                    style={{
                      backgroundColor: "#FEF3C7",
                      border: "1px solid #F59E0B",
                      color: "#78350F",
                    }}
                  >
                    {action.followUpNote ?? "—"}
                  </div>
                </div>
              )}
            </div>

            {/* Attachment Notes (optional) */}
            {action.attachmentNotes && (
              <div className="mt-1">
                <p className="text-muted small mb-1 fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.06em" }}>
                  Attachment Notes
                </p>
                <p className="mb-0 text-dark small" style={{ whiteSpace: "pre-wrap" }}>
                  📎 {action.attachmentNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActionsTakenList;
