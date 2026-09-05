import React, { useState, useEffect, ChangeEvent } from "react";
import { useRequesterContext } from "../context/RequesterContext.js";
import {
  Ticket,
  Attachment,
  getTicketDetail,
  uploadAttachmentToTicket,
  softRemoveAttachment,
  getAttachmentDownloadUrl,
} from "../api.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface TicketDetailViewProps {
  ticketId: string;
  onBackToTickets?: () => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  ticketId,
  onBackToTickets,
}) => {
  const { currentRequester } = useRequesterContext();

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

  const fetchDetail = async () => {
    if (!currentRequester) return;
    setIsLoading(true);
    setError(null);
    setIs403(false);
    try {
      const data = await getTicketDetail(ticketId, currentRequester.id);
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
  }, [ticketId, currentRequester?.id]);

  // Handle Soft Removal Confirmation
  const handleConfirmRemoval = async () => {
    if (!selectedAttachment || !currentRequester) return;
    const trimmedReason = removalReason.trim();
    if (trimmedReason.length < 3) {
      setRemovalError("Removal reason must be at least 3 characters long.");
      return;
    }

    setIsRemoving(true);
    setRemovalError(null);
    try {
      await softRemoveAttachment(selectedAttachment.id, trimmedReason, currentRequester.id);
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

  // Handle Additional Attachment Upload
  const handleUploadFiles = async (filesToAdd: FileList | File[]) => {
    if (!currentRequester || !ticket) return;
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
      formData.append("requesterId", currentRequester.id);
      files.forEach((f) => formData.append("attachments", f));

      await uploadAttachmentToTicket(ticket.id, formData, currentRequester.id);
      await fetchDetail();
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload file attachment");
    } finally {
      setIsUploading(false);
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
      {/* Navigation & Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-3 mb-4 border-bottom">
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-sm btn-zen-outline d-flex align-items-center gap-1" onClick={onBackToTickets}>
            ← Back to My Tickets
          </button>
          <div>
            <h2 className="h4 fw-bold mb-0 text-zen-primary">{ticket.ticketNumber}</h2>
            <small className="text-muted">
              Submitted on {new Date(ticket.createdAt).toLocaleString()}
            </small>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-warning text-dark px-3 py-2 fs-6">
            Priority: {ticket.requestedPriority}
          </span>
          <span className="badge bg-zen-pale text-zen-primary border border-zen-primary px-3 py-2 fs-6">
            Status: {ticket.currentStatus}
          </span>
        </div>
      </div>

      {/* Read-Only Ticket Meta Information Grid */}
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
            <input
              type="text"
              className="form-control form-control-sm bg-zen-readonly text-dark fw-semibold"
              value={ticket.requester?.name ? `${ticket.requester.name} (${ticket.requester.email})` : "N/A"}
              readOnly
              disabled
            />
          </div>
        </div>
      </div>

      {/* Read-Only Ticket Content */}
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

      {/* Attachments Section */}
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

        {/* Active Attachments List */}
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
                      <strong className="d-block text-dark">{att.fileName}</strong>
                      <small className="text-muted">
                        {(att.fileSize / 1024).toFixed(1)} KB • Uploaded {new Date(att.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <a
                      href={getAttachmentDownloadUrl(att.id, currentRequester?.id || "")}
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

        {/* Soft-Removed Attachments Metadata Section */}
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
                      <strong className="text-dark text-decoration-line-through">{att.fileName}</strong>
                      <small>({(att.fileSize / 1024).toFixed(1)} KB)</small>
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

      {/* Soft Removal Confirmation Modal */}
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
