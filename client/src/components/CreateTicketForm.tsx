import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRequesterContext } from "../context/RequesterContext";
import {
  Category,
  RelatedSystem,
  Ticket,
  getCategories,
  getRelatedSystems,
  createTicket,
} from "../api";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface CreateTicketFormProps {
  onSuccessRedirect?: (ticket: Ticket) => void;
  onCancel?: () => void;
}

export const CreateTicketForm: React.FC<CreateTicketFormProps> = ({
  onSuccessRedirect,
  onCancel,
}) => {
  const { currentRequester } = useRequesterContext();

  // Reference Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  // Form Field State
  const [categoryId, setCategoryId] = useState<string>("");
  const [relatedSystemId, setRelatedSystemId] = useState<string>("");
  const [requestedPriority, setRequestedPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [summary, setSummary] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // Validation & Submission State
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    async function loadReferenceData() {
      setIsDataLoading(true);
      try {
        const [cats, syss] = await Promise.all([
          getCategories(),
          getRelatedSystems().catch(() => []),
        ]);
        setCategories(cats);
        setRelatedSystems(syss);
        if (cats.length > 0) setCategoryId(cats[0].id.toString());
      } catch (err: any) {
        console.error("Error loading reference data:", err);
      } finally {
        setIsDataLoading(false);
      }
    }
    loadReferenceData();
  }, []);

  // File Picker / Drag & Drop Handler
  const handleFileAdd = (filesToAdd: FileList | File[]) => {
    setAttachmentError(null);
    const newFiles: File[] = Array.from(filesToAdd);
    const updatedList = [...stagedFiles];

    for (const file of newFiles) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setAttachmentError(`Invalid file type: "${file.name}". Only JPG, PNG, WEBP, and PDF files are allowed.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setAttachmentError(`File "${file.name}" exceeds maximum 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB).`);
        return;
      }
      if (updatedList.length >= 5) {
        setAttachmentError("Maximum 5 active attachments allowed per ticket.");
        return;
      }
      updatedList.push(file);
    }

    setStagedFiles(updatedList);
  };

  const handleFileRemove = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!categoryId) {
      errors.categoryId = "Category selection is required.";
    }

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      errors.summary = "Ticket Summary is required.";
    } else if (trimmedSummary.length < 5) {
      errors.summary = "Summary must be at least 5 characters long.";
    } else if (trimmedSummary.length > 150) {
      errors.summary = "Summary cannot exceed 150 characters.";
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      errors.description = "Problem Description is required.";
    } else if (trimmedDescription.length < 10) {
      errors.description = "Description must be at least 10 characters long.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!currentRequester) {
      setApiError("No active Development Requester selected. Please select a requester identity.");
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("requesterId", currentRequester.id);
      formData.append("categoryId", categoryId);
      if (relatedSystemId) formData.append("relatedSystemId", relatedSystemId);
      formData.append("requestedPriority", requestedPriority);
      formData.append("summary", summary.trim());
      formData.append("description", description.trim());

      stagedFiles.forEach((file) => {
        formData.append("attachments", file);
      });

      const ticket = await createTicket(formData, currentRequester.id);
      setCreatedTicket(ticket);
    } catch (err: any) {
      console.error("Ticket submission error:", err);
      setApiError(
        err.message || "Failed to submit ticket. Server error (500). Your form data has been preserved."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Success Confirmation View
  if (createdTicket) {
    return (
      <div className="card-zen p-4 border-0 shadow-sm" style={{ borderRadius: "0.75rem" }}>
        <div className="alert alert-success border-0 bg-zen-pale text-zen-primary p-4 rounded-3 text-center mb-4">

          <h4 className="fw-bold mb-2">Ticket Submitted Successfully!</h4>
          <p className="mb-1 text-secondary">
            Official Ticket Number:{" "}
            <strong className="fs-5 text-zen-primary bg-white px-3 py-1 rounded border border-zen-primary d-inline-block">
              {createdTicket.ticketNumber}
            </strong>
          </p>
          <small className="text-muted">Initial Current Status: <strong>NEW</strong></small>
        </div>

        <div className="bg-light p-3 rounded mb-4">
          <div className="row g-2">
            <div className="col-md-6">
              <strong>Summary:</strong> {createdTicket.summary}
            </div>
            <div className="col-md-6">
              <strong>Category:</strong> {createdTicket.category?.name || "N/A"}
            </div>
            <div className="col-md-6">
              <strong>Requested Priority:</strong>{" "}
              <span className="badge bg-warning text-dark">{createdTicket.requestedPriority}</span>
            </div>
            <div className="col-md-6">
              <strong>Attachments:</strong> {createdTicket.attachments?.length || 0} file(s)
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-center gap-3">
          <button
            className="btn btn-zen-outline px-4"
            onClick={() => {
              setCreatedTicket(null);
              setSummary("");
              setDescription("");
              setStagedFiles([]);
              setFieldErrors({});
              setApiError(null);
            }}
          >
            Submit Another Ticket
          </button>
          <button
            className="btn btn-zen-primary px-4"
            onClick={() => onSuccessRedirect && onSuccessRedirect(createdTicket)}
          >
            View My Tickets →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-zen p-4 shadow-sm" style={{ borderRadius: "0.75rem" }}>
      <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
        <div>
          <h2 className="h4 fw-bold mb-1 text-zen-primary">Create Support Ticket</h2>
          <p className="text-muted mb-0 small">Describe your issue and attach supporting files for IT triage.</p>
        </div>
      </div>

      {/* Global Server Error Alert */}
      {apiError && (
        <div className="alert alert-danger d-flex align-items-center gap-3 shadow-sm mb-4" role="alert">
          <span className="fs-4">⚠️</span>
          <div>
            <strong>Submission Failure:</strong> {apiError}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* System Generated & Read-Only Context Bar */}
        <div className="card mb-4 border-0 bg-zen-readonly p-3" style={{ borderRadius: "0.5rem" }}>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label text-muted small mb-1">Ticket Number</label>
              <input
                type="text"
                className="form-control form-control-sm bg-zen-readonly text-secondary fw-semibold border-secondary-subtle"
                value="(Auto-generated upon submission)"
                readOnly
                disabled
              />
            </div>
            <div className="col-md-3">
              <label className="form-label text-muted small mb-1">Initial Status</label>
              <input
                type="text"
                className="form-control form-control-sm bg-zen-readonly text-success fw-bold border-secondary-subtle"
                value="NEW"
                readOnly
                disabled
              />
            </div>
            <div className="col-md-6">
              <label className="form-label text-muted small mb-1">Requester Identity (Read-Only)</label>
              <input
                type="text"
                className="form-control form-control-sm bg-zen-readonly text-dark fw-semibold border-secondary-subtle"
                value={
                  currentRequester
                    ? `${currentRequester.name} (${currentRequester.email})`
                    : "No active requester context"
                }
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        {/* Classification Group */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label htmlFor="categoryId" className="form-label fw-semibold">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="categoryId"
              className={`form-select ${fieldErrors.categoryId ? "is-invalid" : ""}`}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (fieldErrors.categoryId) setFieldErrors({ ...fieldErrors, categoryId: "" });
              }}
              disabled={isDataLoading || isSubmitting}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <div className="invalid-feedback">{fieldErrors.categoryId}</div>
            )}
          </div>

          <div className="col-md-4">
            <label htmlFor="relatedSystemId" className="form-label fw-semibold">
              Related System <span className="text-muted fw-normal">(Optional)</span>
            </label>
            <select
              id="relatedSystemId"
              className="form-select"
              value={relatedSystemId}
              onChange={(e) => setRelatedSystemId(e.target.value)}
              disabled={isDataLoading || isSubmitting}
            >
              <option value="">-- None / Not Applicable --</option>
              {relatedSystems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label fw-semibold">
              Requested Priority <span className="text-danger">*</span>
            </label>
            <select
              id="requestedPriority"
              className="form-select"
              value={requestedPriority}
              onChange={(e) => setRequestedPriority(e.target.value as any)}
              disabled={isSubmitting}
            >
              <option value="LOW">Low - Minor issue / inquiry</option>
              <option value="MEDIUM">Medium - Normal operational impact</option>
              <option value="HIGH">High - Significant work disruption</option>
              <option value="URGENT">Urgent - Critical blockage</option>
            </select>
          </div>
        </div>

        {/* Ticket Summary Input */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label htmlFor="summary" className="form-label fw-semibold mb-0">
              Ticket Summary <span className="text-danger">*</span>
            </label>
            <small className={`form-text ${summary.length > 150 ? "text-danger fw-bold" : "text-muted"}`}>
              {summary.length} / 150 chars
            </small>
          </div>
          <input
            type="text"
            id="summary"
            className={`form-control ${fieldErrors.summary ? "is-invalid" : ""}`}
            placeholder="e.g. Laptop battery drains quickly after Windows update"
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              if (fieldErrors.summary) setFieldErrors({ ...fieldErrors, summary: "" });
            }}
            maxLength={150}
            disabled={isSubmitting}
          />
          {fieldErrors.summary && <div className="invalid-feedback">{fieldErrors.summary}</div>}
        </div>

        {/* Problem Description Textarea */}
        <div className="mb-4">
          <label htmlFor="description" className="form-label fw-semibold">
            Problem Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="description"
            rows={5}
            className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
            placeholder="Provide a detailed explanation of the issue, steps to reproduce, error messages seen, etc."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (fieldErrors.description) setFieldErrors({ ...fieldErrors, description: "" });
            }}
            disabled={isSubmitting}
          ></textarea>
          {fieldErrors.description && <div className="invalid-feedback">{fieldErrors.description}</div>}
        </div>

        {/* Attachment Section */}
        <div className="mb-4 p-3 bg-light rounded border">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <label className="form-label fw-semibold mb-0">
              Attachments <span className="text-muted fw-normal">(Optional, Max 5 files, 5MB each)</span>
            </label>
            <span className="badge bg-secondary">
              {stagedFiles.length} / 5 active files
            </span>
          </div>

          {attachmentError && (
            <div className="alert alert-danger py-2 px-3 small mb-3">{attachmentError}</div>
          )}

          {/* File Drag/Picker Box */}
          <div
            className="border-2 border-dashed rounded p-3 text-center bg-white cursor-pointer mb-3"
            style={{ borderStyle: "dashed", borderColor: "#cbd5e1" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleFileAdd(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              id="filePicker"
              className="d-none"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) handleFileAdd(e.target.files);
              }}
              disabled={isSubmitting || stagedFiles.length >= 5}
            />
            <label htmlFor="filePicker" className="cursor-pointer mb-0">
              <span className="fs-3 text-zen-primary d-block mb-1">📎</span>
              <span className="fw-semibold text-zen-primary d-block">
                Drag & drop files here or click to browse
              </span>
              <small className="text-muted">Allowed formats: JPG, PNG, WEBP, PDF (Max 5MB per file)</small>
            </label>
          </div>

          {/* Staged Files Chips */}
          {stagedFiles.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {stagedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="badge bg-white text-dark border d-flex align-items-center gap-2 p-2 shadow-sm"
                  style={{ fontSize: "0.85rem" }}
                >
                  <span>📄 {file.name}</span>
                  <small className="text-muted">({(file.size / 1024).toFixed(0)} KB)</small>
                  <button
                    type="button"
                    className="btn-close ms-1"
                    style={{ fontSize: "0.65rem" }}
                    onClick={() => handleFileRemove(idx)}
                    disabled={isSubmitting}
                    title="Remove file"
                  ></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="d-flex align-items-center justify-content-end gap-3 border-top pt-3">
          {onCancel && (
            <button
              type="button"
              className="btn btn-outline-secondary px-4"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-zen-primary px-5 d-flex align-items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Submitting Ticket...</span>
              </>
            ) : (
              <span>Submit Support Ticket</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
