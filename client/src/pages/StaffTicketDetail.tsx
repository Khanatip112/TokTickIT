import React, { useCallback, useEffect, useState } from "react";
import {
  StaffTicketDetail as StaffTicketDetailModel,
  StaffTicketStatus,
  StaffUser,
  TicketPriority,
  assignStaffTicket,
  claimStaffTicket,
  getStaffTicket,
  getStaffUsers,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { PriorityBadge, PRIORITY_OPTIONS } from "../components/PriorityBadge.js";
import { TicketStatusBadge, TICKET_STATUS_OPTIONS } from "../components/TicketStatusBadge.js";

interface StaffTicketDetailProps {
  ticketId: string;
  /** Navigates back to `/staff/queue`. */
  onBackToQueue?: () => void;
}

const MIN_RESOLUTION_LENGTH = 5;
const MAX_RESOLUTION_LENGTH = 1000;
const RESOLUTION_TARGETS: StaffTicketStatus[] = ["RESOLVED", "CLOSED"];

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
    </div>
  );
};

export default StaffTicketDetail;





