import React, { useState, useEffect, ChangeEvent } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Ticket,
  Attachment,
  TicketComment,
  getTicketDetail,
  uploadAttachmentToTicket,
  softRemoveAttachment,
  getAttachmentDownloadUrl,
  indicateProblemResolved,
  getTicketComments,
  postTicketComment,
} from "../api";
import { PriorityBadge } from "./PriorityBadge";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketCommentItem } from "./TicketCommentItem";

const MAX_COMMENT_LENGTH = 2000;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** Active statuses that may show the "Problem Appears Resolved" action (ui-spec §4.7). */
const INDICATION_ACTIVE_STATUSES: Ticket["currentStatus"][] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
];

interface TicketDetailViewProps {
  ticketId: string;
  onBackToTickets?: () => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  ticketId,
  onBackToTickets,
}) => {
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [is403, setIs403] = useState<boolean>(false);

  // Soft Removal Modal State
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState<string>("");
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [removalError, setRemovalError] = useState<string | null>(null);

  // Upload Additional Attachment State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // "Problem Appears Resolved" indication state (BR-16 / FR-12, ui-spec §4.7)
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [isIndicating, setIsIndicating] = useState<boolean>(false);
  const [indicationError, setIndicationError] = useState<string | null>(null);
  const [indicationDone, setIndicationDone] = useState<boolean>(false);

  // Public Comments (Issue 8 / FR-20). Internal Notes are never fetched or
  // rendered here — the Requester view must not expose the confidential stream.
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);

  const fetchDetail = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    setIs403(false);
    try {
      const data = await getTicketDetail(ticketId, user.id);
      setTicket(data);
    } catch (err: any) {
      console.error("Error fetching ticket detail:", err);
      if (err.status === 403) {
        setIs403(true);
        setError("Access Denied: You do not have permission to view or manage this support ticket.");
      } else {
        setError(err.message || "Failed to load ticket details");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [ticketId, user?.id]);

  /** Loads the Public Comments stream (owner access enforced server-side). */
  const loadComments = async () => {
    if (!user) return;
    try {
      const list = await getTicketComments(ticketId);
      setComments(list);
      setCommentsError(null);
    } catch (err: any) {
      setCommentsError(err?.message || "Failed to load public comments.");
    }
  };

  useEffect(() => {
    loadComments();
  }, [ticketId, user?.id]);

  /** Appends a public comment (BR-18 append-only — no edits afterwards). */
  const handlePostComment = async () => {
    const content = commentDraft.trim();
    if (!content || isPostingComment) return;
    setIsPostingComment(true);
    setCommentsError(null);
    try {
      const created = await postTicketComment(ticketId, content);
      setComments((prev) => [...prev, created]);
      setCommentDraft("");
    } catch (err: any) {
      setCommentsError(err.message || "Failed to post the comment.");
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleConfirmRemoval = async () => {
    if (!selectedAttachment || !user) return;
    const trimmedReason = removalReason.trim();
    if (trimmedReason.length < 3) {
      setRemovalError("Removal reason must be at least 3 characters long.");
      return;
    }

    setIsRemoving(true);
    setRemovalError(null);
    try {
      await softRemoveAttachment(selectedAttachment.id, trimmedReason, user.id);
      setSelectedAttachment(null);
      setRemovalReason("");
      await fetchDetail();
    } catch (err: any) {
      console.error("Soft removal error:", err);
      setRemovalError(err.message || "Failed to soft-remove attachment");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUploadFiles = async (filesToAdd: FileList | File[]) => {
    if (!user || !ticket) return;
    setUploadError(null);

    const files = Array.from(filesToAdd);
    const activeAttachments = ticket.attachments?.filter((a) => !a.isRemoved) || [];
    if (activeAttachments.length + files.length > 5) {
      setUploadError("Maximum 5 active attachments allowed per ticket.");
      return;
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setUploadError(`Invalid file type: "${file.name}". Only JPG, PNG, WEBP, and PDF files are allowed.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(`File "${file.name}" exceeds maximum 5MB limit.`);
        return;
      }
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("requesterId", user.id);
      files.forEach((f) => formData.append("attachments", f));

      await uploadAttachmentToTicket(ticket.id, formData, user.id);
      await fetchDetail();
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload file attachment");
    } finally {
      setIsUploading(false);
    }
  };

  /** Confirms the Requester's resolution indication (status stays unchanged). */
  const handleConfirmIndication = async () => {
    if (!ticket) return;
    setIsIndicating(true);
    setIndicationError(null);
    try {
      await indicateProblemResolved(ticket.id);
      setIndicationDone(true);
      setShowResolveModal(false);
    } catch (err: any) {
      console.error("Resolution indication error:", err);
      setIndicationError(err.message || "The resolution indication could not be recorded.");
    } finally {
      setIsIndicating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card-zen p-5 text-center shadow-sm">
        <div className="spinner-border text-zen-primary" role="status">
          <span className="visually-hidden">Loading ticket details...</span>
        </div>
        <p className="mt-3 text-muted">Loading ticket details...</p>
      </div>
    );
  }

  if (is403) {
    return (
      <div className="card-zen p-5 text-center shadow-sm border-danger" style={{ borderRadius: "0.75rem" }}>
        <div className="fs-1 text-danger mb-3">🔒</div>
        <h3 className="h4 text-danger fw-bold mb-2">403 Forbidden - Access Denied</h3>
        <p className="text-secondary mb-4">{error}</p>
        <div>
          <button className="btn btn-zen-primary px-4" onClick={onBackToTickets}>
            ← Back to My Tickets
          </button>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="card-zen p-4 shadow-sm" style={{ borderRadius: "0.75rem" }}>
        <div className="alert alert-danger mb-3" role="alert">
          {error || "Ticket not found"}
        </div>
        <button className="btn btn-outline-secondary" onClick={onBackToTickets}>
          ← Back to My Tickets
        </button>
      </div>
    );
  }

  const activeAttachments = ticket.attachments?.filter((a) => !a.isRemoved) || [];
  const removedAttachments = ticket.attachments?.filter((a) => a.isRemoved) || [];

  return (
    <div className="card-zen p-4 shadow-sm" style={{ borderRadius: "0.75rem" }}>
      {/* 1. Breadcrumb Path */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <button
              type="button"
              onClick={onBackToTickets}
              className="btn btn-link p-0 text-decoration-none fw-semibold"
              style={{ color: "#006B3C" }}
            >
              My Tickets
            </button>
          </li>
          <li className="breadcrumb-item active text-secondary" aria-current="page">
            Ticket Details
          </li>
        </ol>
      </nav>

      {/* Header Section */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-3 mb-4 border-bottom">
        <div>
          <h2 className="h4 fw-bold mb-0 text-zen-primary">{ticket.ticketNumber}</h2>
          <small className="text-muted">
            Submitted on {new Date(ticket.createdAt).toLocaleString()}
          </small>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {/* Read-only badges: requested priority + status (Zen Green tokens) */}
          <span className="d-inline-flex align-items-center gap-2">
            <span className="small text-muted">Requested Priority</span>
            <PriorityBadge priority={ticket.requestedPriority} />
          </span>
          <span className="d-inline-flex align-items-center gap-2">
            <span className="small text-muted">Status</span>
            <TicketStatusBadge status={ticket.currentStatus} />
          </span>
        </div>
      </div>

      {/* Readonly Grid */}
      <div className="card border-0 bg-zen-readonly p-3 mb-4" style={{ borderRadius: "0.5rem" }}>
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label text-muted small mb-1">Ticket Number</label>
            <input
              type="text"
              className="form-control form-control-sm bg-zen-readonly text-dark fw-bold"
              value={ticket.ticketNumber}
              readOnly
              disabled
            />
          </div>
          <div className="col-md-3">
            <label className="form-label text-muted small mb-1">Category</label>
            <input
              type="text"
              className="form-control form-control-sm bg-zen-readonly text-dark fw-semibold"
              value={ticket.category?.name || "N/A"}
              readOnly
              disabled
            />
          </div>
          <div className="col-md-3">
            <label className="form-label text-muted small mb-1">Related System</label>
            <input
              type="text"
              className="form-control form-control-sm bg-zen-readonly text-dark fw-semibold"
              value={ticket.relatedSystem?.name || "None Specified"}
              readOnly
              disabled
            />
          </div>
          <div className="col-md-3">
            <label className="form-label text-muted small mb-1">Requester</label>
            {/* 3. แสดงเฉพาะชื่อ Requester (ตัด Email ออก) */}
            <input
              type="text"
              className="form-control form-control-sm bg-zen-readonly text-dark fw-semibold"
              value={ticket.requester?.name || "N/A"}
              readOnly
              disabled
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="form-label fw-bold text-dark">Ticket Summary</label>
        <div className="p-3 bg-white border rounded fw-semibold text-dark">{ticket.summary}</div>
      </div>

      <div className="mb-4">
        <label className="form-label fw-bold text-dark">Problem Description</label>
        <div className="p-3 bg-white border rounded text-dark" style={{ whiteSpace: "pre-wrap", minHeight: "100px" }}>
          {ticket.description}
        </div>
      </div>

      {/* Public Comments (Issue 8 / FR-20) — Requesters read and post public          comments only; the Internal Notes stream is never rendered here. */}
      <div className="mb-4" data-testid="requester-public-comments">
        <label className="form-label fw-bold text-dark d-flex align-items-center gap-2">
          <span>💬 Public Comments</span>
          <span className="badge bg-secondary fs-6 fw-normal">{comments.length}</span>
        </label>
        {commentsError && (
          <div className="alert alert-danger py-2 small mb-2" role="alert">
            {commentsError}
          </div>
        )}
        <label htmlFor="requester-comment-input" className="form-label small text-muted mb-1">
          Add Public Comment
        </label>
        <textarea
          id="requester-comment-input"
          data-testid="requester-comment-input"
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
            Append-only — comments cannot be edited or deleted once posted.
          </small>
          <button
            type="button"
            className="btn btn-zen-primary btn-sm"
            data-testid="post-comment"
            onClick={handlePostComment}
            disabled={isPostingComment || commentDraft.trim().length === 0}
          >
            {isPostingComment ? "Posting…" : "Post Comment"}
          </button>
        </div>
        {comments.length === 0 ? (
          <p
            className="text-muted small mb-0 border p-3 rounded bg-light"
            data-testid="public-comments-empty"
          >
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

      {/* BR-16 / FR-12 — "Problem Appears Resolved" indication (status is NOT changed) */}
      {INDICATION_ACTIVE_STATUSES.includes(ticket.currentStatus) &&
        (indicationDone ? (
          <div
            className="alert mb-4 d-flex align-items-start gap-2"
            role="status"
            data-testid="resolution-indication-done"
            style={{ backgroundColor: "#EAF6EF", border: "1px solid rgba(0, 107, 60, 0.15)", color: "#006B3C" }}
          >
            <span aria-hidden="true">✅</span>
            <div>
              <strong>Resolution indication recorded.</strong> IT Staff has been notified to verify
              and formally resolve your ticket. The status has not changed yet.
            </div>
          </div>
        ) : (
          <div
            className="card mb-4"
            data-testid="resolve-indication-card"
            style={{
              backgroundColor: "#EAF6EF",
              border: "1px solid rgba(0, 107, 60, 0.15)",
              borderRadius: "0.75rem",
            }}
          >
            <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h6 className="fw-bold mb-1" style={{ color: "#006B3C" }}>
                  <span aria-hidden="true">ℹ️</span> Has your issue been resolved?
                </h6>
                <p className="text-secondary small mb-0">
                  If your issue has been fixed, click below to notify IT Staff.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-zen-primary px-4"
                onClick={() => {
                  setIndicationError(null);
                  setShowResolveModal(true);
                }}
              >
                Problem Appears Resolved
              </button>
            </div>
          </div>
        ))}

      <div className="border-top pt-4 mt-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h5 className="fw-bold mb-0 text-zen-primary d-flex align-items-center gap-2">
            <span>📎 Attachments</span>
            <span className="badge bg-secondary fs-6 fw-normal">
              {activeAttachments.length} / 5 active files
            </span>
          </h5>
          {activeAttachments.length < 5 && (
            <div>
              <input
                type="file"
                id="addAttachmentInput"
                className="d-none"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  if (e.target.files) handleUploadFiles(e.target.files);
                }}
                disabled={isUploading}
              />
              <label htmlFor="addAttachmentInput" className="btn btn-sm btn-zen-outline mb-0 cursor-pointer">
                {isUploading ? "Uploading..." : "+ Add Attachment"}
              </label>
            </div>
          )}
        </div>

        {uploadError && <div className="alert alert-danger p-2 small mb-3">{uploadError}</div>}

        <div className="mb-4">
          <h6 className="text-muted small fw-semibold text-uppercase mb-2">Active Supporting Files</h6>
          {activeAttachments.length === 0 ? (
            <p className="text-muted small italic border p-3 rounded bg-light">No active attachments attached to this ticket.</p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {activeAttachments.map((att) => (
                <div
                  key={att.id}
                  className="card p-3 border d-flex flex-row align-items-center justify-content-between bg-white shadow-sm"
                >
                  <div className="d-flex align-items-center gap-3">
                    <span className="fs-4">📄</span>
                    <div>
                      <strong className="d-block text-dark">{att.originalName || att.fileName}</strong>
                      <small className="text-muted">
                        {(att.sizeBytes / 1024).toFixed(1)} KB • Uploaded {new Date(att.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <a
                      href={getAttachmentDownloadUrl(att.id, user?.id || "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                    >
                      <span>⬇️ Download</span>
                    </a>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => {
                        setSelectedAttachment(att);
                        setRemovalReason("");
                        setRemovalError(null);
                      }}
                    >
                      Soft Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {removedAttachments.length > 0 && (
          <div className="mt-4 pt-3 border-top">
            <h6 className="text-muted small fw-semibold text-uppercase mb-2">
              Soft-Removed Files Audit Log ({removedAttachments.length})
            </h6>
            <div className="d-flex flex-column gap-2">
              {removedAttachments.map((att) => (
                <div
                  key={att.id}
                  className="card p-3 border bg-light text-muted opacity-75"
                  style={{ borderRadius: "0.5rem" }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-secondary text-white">Soft Removed</span>
                      <strong className="text-dark text-decoration-line-through">{att.originalName || att.fileName}</strong>
                      <small>({(att.sizeBytes / 1024).toFixed(1)} KB)</small>
                    </div>
                    <button className="btn btn-sm btn-secondary disabled" disabled>
                      Download Unavailable
                    </button>
                  </div>
                  <div className="alert alert-warning py-2 px-3 small mb-0 border-0 bg-warning bg-opacity-10 text-dark">
                    <strong>Removal Audit Trail:</strong> Soft-removed on{" "}
                    {att.removedAt ? new Date(att.removedAt).toLocaleString() : "N/A"}.<br />
                    <strong>Reason:</strong> "{att.removalReason || "No reason specified"}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* "Problem Appears Resolved" confirmation modal (ui-spec §4.7) */}
      {showResolveModal && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-indication-modal-title"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: "0.75rem" }}>
              <div className="modal-header text-white" style={{ backgroundColor: "#006B3C" }}>
                <h5 className="modal-title fw-bold" id="resolve-indication-modal-title">
                  Problem Appears Resolved
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setShowResolveModal(false)}
                  disabled={isIndicating}
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-dark mb-3">
                  Confirm that your issue has been resolved. This will notify IT Staff to formally
                  close your ticket.
                </p>
                <div className="alert alert-secondary small mb-0">
                  Your ticket status will not change until IT Staff verifies the fix.
                </div>
                {indicationError && (
                  <div className="alert alert-danger py-2 small mt-3 mb-0" role="alert">
                    {indicationError}
                  </div>
                )}
              </div>
              <div className="modal-footer border-top-0 px-4 pb-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResolveModal(false)}
                  disabled={isIndicating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-zen-primary"
                  data-testid="confirm-resolve-indication"
                  onClick={handleConfirmIndication}
                  disabled={isIndicating}
                >
                  {isIndicating ? "Submitting…" : "Confirm — Problem Resolved"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAttachment && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: "0.75rem" }}>
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">Confirm Attachment Soft Removal</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedAttachment(null)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-dark mb-3">
                  Are you sure you want to soft-remove attachment <strong>"{selectedAttachment.fileName}"</strong>?
                </p>
                <div className="alert alert-warning small mb-3">
                  <strong>Notice:</strong> Soft removal records this file as removed for audit compliance. The file will no longer be downloadable or previewable.
                </div>

                {removalError && <div className="alert alert-danger py-2 small mb-3">{removalError}</div>}

                <div className="mb-3">
                  <label htmlFor="removalReasonInput" className="form-label fw-semibold">
                    Reason for Removal <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="removalReasonInput"
                    rows={3}
                    className="form-control"
                    placeholder="e.g., Uploaded wrong document version / file contains sensitive information"
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    disabled={isRemoving}
                  ></textarea>
                  <small className="text-muted">Minimum 3 characters required.</small>
                </div>
              </div>
              <div className="modal-footer border-top-0 px-4 pb-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedAttachment(null)}
                  disabled={isRemoving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmRemoval}
                  disabled={isRemoving || removalReason.trim().length < 3}
                >
                  {isRemoving ? "Removing..." : "Soft Remove Attachment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};