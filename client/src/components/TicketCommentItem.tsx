import React from "react";
import type { TicketComment } from "../api.js";
import { RoleBadge } from "./RoleBadge.js";

/**
 * Append-only comment/note timeline entry (ui-spec.md §4.5, FR-20 / FR-21).
 *
 * BR-18: by design this component renders NO edit or delete controls — once a
 * comment or internal note is created it can never be modified.
 *
 * `variant="internal"` applies the confidential pale-amber styling required
 * by the ui-spec so Internal Notes can never be confused with public messages.
 */
interface TicketCommentItemProps {
  comment: TicketComment;
  variant?: "public" | "internal";
}

/** e.g. `May 13, 2025 11:45 AM` (ui-spec §4.5 timestamp format). */
export function formatCommentTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}

/** Author initials circle, e.g. `Jennifer Anderson` → `JA`. */
export function commentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return initials || "?";
}

export const TicketCommentItem: React.FC<TicketCommentItemProps> = ({
  comment,
  variant = "public",
}) => {
  const isInternal = variant === "internal";
  return (
    <article
      data-testid={isInternal ? "internal-note-item" : "public-comment-item"}
      className="rounded border p-3"
      style={{
        backgroundColor: isInternal ? "#FFFBEB" : "#FFFFFF",
        borderColor: isInternal ? "#FDE68A" : "#E0ECE6",
      }}
    >
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span
            aria-hidden="true"
            className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              fontSize: "0.72rem",
              backgroundColor: isInternal ? "#FDE68A" : "#EAF6EF",
              color: isInternal ? "#92400E" : "#006B3C",
              border: `1px solid ${isInternal ? "#F59E0B" : "#006B3C"}`,
            }}
          >
            {commentInitials(comment.author.name)}
          </span>
          <strong className="text-dark small mb-0">{comment.author.name}</strong>
          <RoleBadge role={comment.author.role} />
          {isInternal && (
            <span
              className="badge rounded-pill"
              data-testid="internal-note-badge"
              style={{ backgroundColor: "#FDE68A", color: "#92400E", fontSize: "0.68rem" }}
            >
              🔒 Internal
            </span>
          )}
        </div>
        <time
          className="text-muted text-nowrap"
          style={{ fontSize: "0.75rem" }}
          dateTime={comment.createdAt}
        >
          {formatCommentTimestamp(comment.createdAt)}
        </time>
      </div>
      <p className="mb-0 small text-dark" style={{ whiteSpace: "pre-wrap" }}>
        {comment.content}
      </p>
      {/* BR-18 append-only: no Edit/Delete controls are ever rendered here. */}
    </article>
  );
};

export default TicketCommentItem;
