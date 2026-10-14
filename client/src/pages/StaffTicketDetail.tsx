import React, { useCallback, useEffect, useState } from "react";
import {
  StaffTicketDetail as StaffTicketDetailModel,
  StaffTicketStatus,
  StaffUser,
  TicketComment,
  TicketPriority,
  assignStaffTicket,
  claimStaffTicket,
  getStaffTicket,
  getStaffUsers,
  getTicketComments,
  getTicketInternalNotes,
  postTicketComment,
  postTicketInternalNote,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { PriorityBadge, PRIORITY_OPTIONS } from "../components/PriorityBadge.js";
import { TicketStatusBadge, TICKET_STATUS_OPTIONS } from "../components/TicketStatusBadge.js";
import { TicketCommentItem } from "../components/TicketCommentItem.js";

interface StaffTicketDetailProps {
  ticketId: string;
  /** Navigates back to `/staff/queue`. */
  onBackToQueue?: () => void;
}

const MIN_RESOLUTION_LENGTH = 5;
const MAX_RESOLUTION_LENGTH = 1000;
const MAX_COMMENT_LENGTH = 2000;
const RESOLUTION_TARGETS: StaffTicketStatus[] = ["RESOLVED", "CLOSED"];

/** Activity tabs (ui-spec §4.5). Service Actions is a Lab 4 placeholder. */
type ActivityTab = "comments" | "notes" | "attachments";

const statusLabel = (value: StaffTicketStatus): string =>
  TICKET_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as Error).message === "string") {
    return (err as Error).message;
  }
  return fallback;
}

/**
 * Screen 4 — IT Staff Ticket Detail (`/staff/tickets/:id`), ui-spec.md §4.5.
 *
 * Operational control panel for IT Staff and Administrators: read-only ticket
 * facts alongside the interactive claim/reassign owner select, independent
 * IT Priority select, and a status select constrained to the server-side BR-15
 * transition matrix. Resolving/closing requires a resolution summary (BR-17).
 *
 * Issue 8 adds the Tabbed Activity Section: Public Comments (all roles) and
 * Internal Notes (staff only — lock icon + amber warning per the ui-spec).
 */
export const StaffTicketDetail: React.FC<StaffTicketDetailProps> = ({
  ticketId,
  onBackToQueue,
}) => {
  const { user } = useAuth();

  const [ticket, setTicket] = useState<StaffTicketDetailModel | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Pending status target (applied via "Apply Status Change").
  const [pendingStatus, setPendingStatus] = useState<StaffTicketStatus | "">("");
  const [resolutionSummary, setResolutionSummary] = useState("");

  // Public Comments & Internal Notes streams (Issue 8 / ui-spec §4.5).
  const [activityTab, setActivityTab] = useState<ActivityTab>("comments");
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [notes, setNotes] = useState<TicketComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isPostingNote, setIsPostingNote] = useState(false);

  // Defense-in-depth: Internal Notes are only ever loaded for staff roles,
  // even though `/staff/tickets/:id` is already route-guarded in App.tsx.
  const canViewNotes = user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR";

  /** Loads both activity streams (notes skipped for non-staff roles). */
  const loadActivities = useCallback(async () => {
    try {
      const list = await getTicketComments(ticketId);
      setComments(list);
      setCommentsError(null);
    } catch (err) {
      setCommentsError(errorMessage(err, "Failed to load public comments."));
    }
    if (canViewNotes) {
      try {
        const list = await getTicketInternalNotes(ticketId);
        setNotes(list);
        setNotesError(null);
      } catch (err) {
        setNotesError(errorMessage(err, "Failed to load internal notes."));
      }
    } else {
      setNotes([]);
    }
  }, [ticketId, canViewNotes]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  /** Appends a new public comment (BR-18 append-only — no edits afterwards). */
  const handlePostComment = async () => {
    const content = commentDraft.trim();
    if (!content || isPostingComment) return;
    setIsPostingComment(true);
    setCommentsError(null);
    try {
      const created = await postTicketComment(ticketId, content);
      setComments((prev) => [...prev, created]);
      setCommentDraft("");
    } catch (err) {
      setCommentsError(errorMessage(err, "Failed to post the comment."));
    } finally {
      setIsPostingComment(false);
    }
  };

  /** Appends a new confidential internal note (staff only, BR-18 append-only). */
  const handlePostNote = async () => {
    const content = noteDraft.trim();
    if (!content || isPostingNote) return;
    setIsPostingNote(true);
    setNotesError(null);
    try {
      const created = await postTicketInternalNote(ticketId, content);
      setNotes((prev) => [...prev, created]);
      setNoteDraft("");
    } catch (err) {
      setNotesError(errorMessage(err, "Failed to post the internal note."));
    } finally {
      setIsPostingNote(false);
    }
  };

  const loadTicket = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const detail = await getStaffTicket(ticketId);
      setTicket(detail);
      setResolutionSummary(detail.resolutionSummary ?? "");
      setPendingStatus("");
    } catch (err) {
      setTicket(null);
      setLoadError(errorMessage(err, "Failed to load the ticket."));
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadTicket();
    getStaffUsers()
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [loadTicket]);

  /** Runs a mutation, refreshes the ticket, and surfaces success/error banners. */
  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setIsBusy(true);
      setActionError(null);
      setActionSuccess(null);
      try {
        await action();
        const fresh = await getStaffTicket(ticketId);
        setTicket(fresh);
        setResolutionSummary(fresh.resolutionSummary ?? "");
        setPendingStatus("");
        setActionSuccess(successMessage);
      } catch (err) {
        setActionError(errorMessage(err, "The operation failed."));
      } finally {
        setIsBusy(false);
      }
    },
    [ticketId]
  );

  const handleClaim = () => {
    if (!ticket) return;
    void runAction(() => claimStaffTicket(ticket.id), "Ticket claimed — you are now the owner.");
  };

  const handleOwnerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!ticket) return;
    const value = event.target.value;
    void runAction(
      () => assignStaffTicket(ticket.id, value === "" ? null : value),
      value === "" ? "Ticket returned to the unassigned pool." : "Ticket owner updated."
    );
  };

  const handlePriorityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!ticket) return;
    const value = event.target.value as TicketPriority;
    void runAction(
      () => updateStaffTicketPriority(ticket.id, value),
      "IT Priority updated. The Requester's requested priority is unchanged."
    );
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as StaffTicketStatus | "";
    setActionError(null);
    setActionSuccess(null);
    setPendingStatus(value);
  };

  const handleApplyStatus = () => {
    if (!ticket || pendingStatus === "") return;
    const needsSummary = RESOLUTION_TARGETS.includes(pendingStatus);
    const trimmed = resolutionSummary.trim();

    if (needsSummary && trimmed.length < MIN_RESOLUTION_LENGTH) {
      setActionError(
        `A resolution summary of at least ${MIN_RESOLUTION_LENGTH} characters is required when resolving or closing a ticket.`
      );
      return;
    }
    if (trimmed.length > MAX_RESOLUTION_LENGTH) {
      setActionError(`The resolution summary must not exceed ${MAX_RESOLUTION_LENGTH} characters.`);
      return;
    }

    void runAction(
      () =>
        updateStaffTicketStatus(
          ticket.id,
          pendingStatus,
          needsSummary ? trimmed : undefined
        ),
      `Status changed to ${statusLabel(pendingStatus)}.`
    );
  };

  if (isLoading) {
    return (
      <div data-testid="staff-detail-skeleton" className="card-zen p-4 shadow-sm">
        <div className="d-flex justify-content-between mb-4">
          <div className="zen-skeleton" style={{ width: 220, height: 24, borderRadius: 6 }} />
          <div className="zen-skeleton" style={{ width: 140, height: 36, borderRadius: 8 }} />
        </div>
        <div className="row g-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="col-md-4" key={i}>
              <div className="zen-skeleton mb-2" style={{ height: 14, borderRadius: 4 }} />
              <div className="zen-skeleton" style={{ height: 38, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card-zen p-5 text-center shadow-sm" data-testid="staff-detail-error">
        <div className="fs-1 mb-2" aria-hidden="true">⚠️</div>
        <h2 className="h5 fw-bold text-danger mb-2">Failed to load ticket</h2>
        <p className="text-secondary mb-4">{loadError}</p>
        <div className="d-flex justify-content-center gap-2">
          <button type="button" className="btn btn-zen-primary px-4" onClick={loadTicket}>
            Try Again
          </button>
          {onBackToQueue && (
            <button type="button" className="btn btn-outline-secondary px-4" onClick={onBackToQueue}>
              ← Back to Queue
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="card-zen p-5 text-center shadow-sm" data-testid="staff-detail-error">
        <div className="fs-1 mb-2" aria-hidden="true">🧰</div>
        <h2 className="h5 fw-bold mb-2">Ticket not found</h2>
        <button type="button" className="btn btn-outline-secondary px-4" onClick={onBackToQueue}>
          ← Back to Queue
        </button>
      </div>
    );
  }

  const ownerOptions = staff;
  const isUnassigned = !ticket.owner;
  const ownedByCurrentUser = !!ticket.owner && ticket.owner.id === user?.id;
  const canClaim = isUnassigned || !ownedByCurrentUser;
  const transitionOptions = ticket.permittedTransitions;
  const pendingNeedsSummary = pendingStatus !== "" && RESOLUTION_TARGETS.includes(pendingStatus);

  return (
    <div data-testid="staff-ticket-detail">
      {/* Top bar: breadcrumb + back action (ui-spec §4.5) */}
      <nav aria-label="breadcrumb" className="mb-3 d-flex justify-content-between align-items-center">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none fw-semibold"
              style={{ color: "#006B3C" }}
              onClick={onBackToQueue}
            >
              My Queue
            </button>
          </li>
          <li className="breadcrumb-item active text-secondary" aria-current="page">
            Ticket Detail
          </li>
        </ol>
        <button type="button" className="btn btn-zen-outline btn-sm" onClick={onBackToQueue}>
          ← Back to Queue
        </button>
      </nav>

      {actionError && (
        <div
          className="alert alert-danger py-2 px-3 small mb-3"
          role="alert"
          data-testid="staff-action-error"
        >
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div
          className="alert alert-success py-2 px-3 small mb-3"
          role="status"
          data-testid="staff-action-success"
        >
          {actionSuccess}
        </div>
      )}

      {/* Operational information card */}
      <div className="card-zen p-4 shadow-sm mb-4">
        <h1 className="h5 fw-bold text-zen-primary mb-4">Operational Information</h1>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label htmlFor="field-ticket-number" className="form-label text-muted small mb-1">
              Ticket No
            </label>
            <input
              id="field-ticket-number"
              type="text"
              className="form-control bg-zen-readonly font-monospace fw-bold text-dark"
              value={ticket.ticketNumber}
              readOnly
              disabled
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="field-category" className="form-label text-muted small mb-1">
              Category
            </label>
            <input
              id="field-category"
              type="text"
              className="form-control bg-zen-readonly text-dark"
              value={ticket.category?.name ?? "N/A"}
              readOnly
              disabled
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="field-related-system" className="form-label text-muted small mb-1">
              Related System
            </label>
            <input
              id="field-related-system"
              type="text"
              className="form-control bg-zen-readonly text-dark"
              value={ticket.relatedSystem?.name ?? "None Specified"}
              readOnly
              disabled
            />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label htmlFor="field-requester" className="form-label text-muted small mb-1">
              Requester
            </label>
            <input
              id="field-requester"
              type="text"
              className="form-control bg-zen-readonly text-dark"
              value={`${ticket.requester.name} (${ticket.requester.email})`}
              readOnly
              disabled
            />
          </div>
          <div className="col-md-4">
            <span className="form-label text-muted small mb-1 d-block">Requested Priority</span>
            {/* Read-only: set by the Requester at creation and immutable (BR-12). */}
            <div data-testid="requested-priority-badge" className="d-flex align-items-center gap-2">
              <PriorityBadge priority={ticket.requestedPriority} />
              <small className="text-muted">set by Requester (read-only)</small>
            </div>
          </div>
          <div className="col-md-4">
            <span className="form-label text-muted small mb-1 d-block">Current Status</span>
            <div data-testid="current-status-badge">
              <TicketStatusBadge status={ticket.currentStatus} />
            </div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label htmlFor="status-select" className="form-label fw-semibold text-dark small mb-1">
              Change Status
            </label>
            <select
              id="status-select"
              data-testid="status-select"
              className="form-select"
              value={pendingStatus}
              onChange={handleStatusChange}
              disabled={isBusy}
            >
              <option value="">
                {transitionOptions.length > 0
                  ? "Select new status…"
                  : "No transitions available"}
              </option>
              {transitionOptions.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="owner-select" className="form-label fw-semibold text-dark small mb-1">
              Ticket Owner
            </label>
            <div className="input-group">
              <select
                id="owner-select"
                data-testid="owner-select"
                className="form-select"
                value={ticket.ownerId ?? ""}
                onChange={handleOwnerChange}
                disabled={isBusy}
              >
                <option value="">Unassigned</option>
                {ownerOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.role === "ADMINISTRATOR" ? " (Admin)" : ""}
                  </option>
                ))}
              </select>
              {canClaim && (
                <button
                  type="button"
                  className="btn btn-zen-primary"
                  data-testid="claim-button"
                  onClick={handleClaim}
                  disabled={isBusy}
                >
                  {isUnassigned ? "Claim Ticket" : "Assign to Me"}
                </button>
              )}
            </div>
          </div>
          <div className="col-md-4">
            <label htmlFor="it-priority-select" className="form-label fw-semibold text-dark small mb-1">
              IT Priority
            </label>
            <select
              id="it-priority-select"
              data-testid="it-priority-select"
              className="form-select"
              value={ticket.itPriority}
              onChange={handlePriorityChange}
              disabled={isBusy}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row g-3 mb-1">
          <div className="col-md-4">
            <span className="form-label text-muted small mb-1 d-block">Summary</span>
            <div
              className="p-2 bg-zen-readonly border rounded text-dark small"
              style={{ minHeight: 42 }}
            >
              {ticket.summary}
            </div>
          </div>
          <div className="col-md-8">
            <span className="form-label text-muted small mb-1 d-block">Description</span>
            <div
              className="p-2 bg-zen-readonly border rounded text-dark small"
              style={{ whiteSpace: "pre-wrap", minHeight: 42 }}
            >
              {ticket.description}
            </div>
          </div>
        </div>
      </div>

      {/* Resolution summary + status apply (visible for all, mandatory for RESOLVED/CLOSED) */}
      <div className="card-zen p-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h2 className="h6 fw-bold text-dark mb-1">Resolution Summary</h2>
            <p className="text-muted small mb-0">
              Mandatory when resolving or closing a ticket (BR-17): minimum{" "}
              {MIN_RESOLUTION_LENGTH}, maximum {MAX_RESOLUTION_LENGTH} characters.
            </p>
          </div>
          {pendingStatus !== "" && (
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted">
                New status: <strong>{statusLabel(pendingStatus)}</strong>
              </span>
              <button
                type="button"
                className="btn btn-zen-primary btn-sm"
                data-testid="apply-status"
                onClick={handleApplyStatus}
                disabled={isBusy}
              >
                {isBusy ? "Applying…" : "Apply Status Change"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setPendingStatus("");
                  setActionError(null);
                }}
                disabled={isBusy}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <label htmlFor="resolution-summary" className="form-label small text-muted mb-1">
          Resolution Summary
        </label>
        <textarea
          id="resolution-summary"
          data-testid="resolution-summary"
          className="form-control"
          rows={3}
          placeholder="Describe the root cause and the fix applied…"
          value={resolutionSummary}
          onChange={(e) => setResolutionSummary(e.target.value)}
          disabled={isBusy}
        />
        {pendingNeedsSummary &&
          resolutionSummary.trim().length < MIN_RESOLUTION_LENGTH &&
          actionError === null && (
            <small className="text-warning d-block mt-1">
              A summary of at least {MIN_RESOLUTION_LENGTH} characters is required to set the
              status to {statusLabel(pendingStatus as StaffTicketStatus)}.
            </small>
          )}
      </div>

      {/* Tabbed Activity Section (ui-spec §4.5) */}
      <div className="card-zen shadow-sm mt-3" data-testid="activity-section">
        <div className="px-4 pt-4">
          <ul
            className="nav nav-tabs"
            role="tablist"
            aria-label="Ticket activity"
            style={{ overflowX: "auto" }}
          >
            <li className="nav-item" role="presentation">
              <button
                type="button"
                role="tab"
                id="tab-public-comments"
                aria-controls="panel-public-comments"
                aria-selected={activityTab === "comments"}
                data-testid="public-comments-tab"
                className={`nav-link ${activityTab === "comments" ? "active" : ""}`}
                style={
                  activityTab === "comments"
                    ? { color: "#006B3C", fontWeight: 600, borderBottom: "3px solid #006B3C" }
                    : undefined
                }
                onClick={() => setActivityTab("comments")}
              >
                <span aria-hidden="true" style={{ color: "#006B3C" }}>
                  ●
                </span>{" "}
                Public Comments ({comments.length})
              </button>
            </li>
            {canViewNotes && (
              <li className="nav-item" role="presentation">
                <button
                  type="button"
                  role="tab"
                  id="tab-internal-notes"
                  aria-controls="panel-internal-notes"
                  aria-selected={activityTab === "notes"}
                  data-testid="internal-notes-tab"
                  className={`nav-link ${activityTab === "notes" ? "active" : ""}`}
                  style={
                    activityTab === "notes"
                      ? { color: "#92400E", fontWeight: 600, borderBottom: "3px solid #F59E0B" }
                      : { color: "#92400E" }
                  }
                  onClick={() => setActivityTab("notes")}
                >
                  🔒 Internal Notes ({notes.length})
                </button>
              </li>
            )}
            <li className="nav-item" role="presentation">
              <button
                type="button"
                role="tab"
                id="tab-attachments"
                aria-controls="panel-attachments"
                aria-selected={activityTab === "attachments"}
                data-testid="attachments-tab"
                className={`nav-link ${activityTab === "attachments" ? "active" : ""}`}
                style={
                  activityTab === "attachments"
                    ? { fontWeight: 600, borderBottom: "3px solid #006B3C" }
                    : undefined
                }
                onClick={() => setActivityTab("attachments")}
              >
                Attachments ({ticket.attachments.length})
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={false}
                data-testid="service-actions-tab"
                className="nav-link"
                disabled
                title="Service Actions will be available in Lab 4."
              >
                Service Actions (0)
              </button>
            </li>
          </ul>
        </div>

        <div className="p-4 pt-3">
          {activityTab === "comments" && (
            <div
              id="panel-public-comments"
              role="tabpanel"
              aria-labelledby="tab-public-comments"
              data-testid="public-comments-panel"
            >
              <label htmlFor="staff-comment-input" className="form-label small text-muted mb-1">
                Add Public Comment
              </label>
              <textarea
                id="staff-comment-input"
                data-testid="staff-comment-input"
                className="form-control mb-2"
                rows={3}
                placeholder="Type your comment here..."
                maxLength={MAX_COMMENT_LENGTH}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                disabled={isPostingComment}
              />
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <small className="text-muted">
                  Append-only — comments cannot be edited or deleted once posted. (
                  {commentDraft.trim().length}/2,000)
                </small>
                <button
                  type="button"
                  data-testid="post-comment"
                  className="btn btn-zen-primary btn-sm"
                  onClick={handlePostComment}
                  disabled={isPostingComment || commentDraft.trim().length === 0}
                >
                  {isPostingComment ? "Posting…" : "Post Comment"}
                </button>
              </div>
              {commentsError && (
                <div className="alert alert-danger py-2 small" role="alert">
                  {commentsError}
                </div>
              )}
              {comments.length === 0 ? (
                <p className="text-muted small mb-0" data-testid="public-comments-empty">
                  No public comments yet.
                </p>
              ) : (
                <div className="d-flex flex-column gap-2" data-testid="public-comments-list">
                  {[...comments]
                    .reverse()
                    .map((comment) => (
                      <TicketCommentItem key={comment.id} comment={comment} />
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Internal Notes panel — staff only (FR-21). Amber confidential styling
              per ui-spec §4.5 so notes can never be confused with public messages. */}
          {activityTab === "notes" && canViewNotes && (
            <div
              id="panel-internal-notes"
              role="tabpanel"
              aria-labelledby="tab-internal-notes"
              data-testid="internal-notes-panel"
            >
              <div
                className="rounded border p-2 px-3 mb-3 d-flex align-items-center gap-2"
                style={{ backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }}
                data-testid="internal-notes-warning"
              >
                <span className="fs-5" aria-hidden="true">
                  🔒
                </span>
                <strong className="small" style={{ color: "#92400E" }}>
                  Internal Note — Visible strictly to IT Staff and Administrators
                </strong>
              </div>
              <label htmlFor="staff-note-input" className="form-label small text-muted mb-1">
                Add Internal Note
              </label>
              <textarea
                id="staff-note-input"
                data-testid="staff-note-input"
                className="form-control mb-2"
                rows={3}
                placeholder="Type internal note here..."
                maxLength={MAX_COMMENT_LENGTH}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                disabled={isPostingNote}
              />
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <small className="text-muted">
                  Append-only — internal notes cannot be edited or deleted once posted. (
                  {noteDraft.trim().length}/2,000)
                </small>
                <button
                  type="button"
                  data-testid="post-internal-note"
                  className="btn btn-zen-primary btn-sm"
                  onClick={handlePostNote}
                  disabled={isPostingNote || noteDraft.trim().length === 0}
                >
                  {isPostingNote ? "Posting…" : "Post Internal Note"}
                </button>
              </div>
              {notesError && (
                <div className="alert alert-danger py-2 small" role="alert">
                  {notesError}
                </div>
              )}
              {notes.length === 0 ? (
                <p className="text-muted small mb-0" data-testid="internal-notes-empty">
                  No internal notes yet.
                </p>
              ) : (
                <div className="d-flex flex-column gap-2" data-testid="internal-notes-list">
                  {[...notes]
                    .reverse()
                    .map((note) => (
                      <TicketCommentItem key={note.id} comment={note} variant="internal" />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffTicketDetail;
