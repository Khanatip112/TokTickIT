import React, { useEffect, useState } from "react";
import { ActionTaken, CreateActionTakenPayload } from "../../api.js";

interface ActionTakenFormProps {
  /** When provided, the form operates in "edit" mode pre-populated with these values. */
  editingAction?: ActionTaken | null;
  /** Called with the validated payload on successful submission. */
  onSubmit: (payload: CreateActionTakenPayload) => Promise<void | boolean>;
  /** Called after a new action has been successfully submitted. */
  onActionAdded?: () => Promise<void> | void;
  /** Called when the user clicks Cancel (only shown in edit mode). */
  onCancel?: () => void;
  /** Busy state propagated from parent (disables controls during async save). */
  isSaving?: boolean;
  /** Submission error to display inside the form. */
  submitError?: string | null;
}

const EMPTY_FORM: CreateActionTakenPayload = {
  description: "",
  result: "SUCCESS",
  followUpRequired: false,
  followUpNote: "",
  attachmentNotes: "",
  actionDateTime: "",
};

/**
 * ActionTakenForm — Lab 4 Issue 4
 *
 * Form used by IT Staff and Administrators to log or edit an action taken on a
 * ticket. Supports both "create" mode (blank) and "edit" mode (pre-populated).
 *
 * Client-side validation:
 *  - description and result are required.
 *  - followUpNote is required when followUpRequired is checked.
 *
 * Responsive: single-column on mobile, two-column grid on ≥768 px.
 */
export const ActionTakenForm: React.FC<ActionTakenFormProps> = ({
  editingAction = null,
  onSubmit,
  onActionAdded,
  onCancel,
  isSaving = false,
  submitError = null,
}) => {
  const isEditMode = !!editingAction;

  const [form, setForm] = useState<CreateActionTakenPayload>(EMPTY_FORM);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof CreateActionTakenPayload, string>>>({});

  // Populate form when entering edit mode
  useEffect(() => {
    if (editingAction) {
      setForm({
        description: editingAction.description,
        result: editingAction.result || "SUCCESS",
        followUpRequired: editingAction.followUpRequired,
        followUpNote: editingAction.followUpNote ?? "",
        attachmentNotes: editingAction.attachmentNotes ?? "",
        actionDateTime: editingAction.actionDateTime
          ? editingAction.actionDateTime.slice(0, 16) // datetime-local format
          : "",
      });
      setValidationErrors({});
    } else {
      setForm(EMPTY_FORM);
      setValidationErrors({});
    }
  }, [editingAction]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ?? false) : value,
      // Clear followUpNote error when checkbox is un-ticked
      ...(name === "followUpRequired" && !checked ? { followUpNote: "" } : {}),
    }));
    // Clear field-level error on change
    setValidationErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof CreateActionTakenPayload, string>> = {};

    if (!form.description.trim()) {
      errors.description = "Description is required.";
    }
    if (!form.result?.trim()) {
      errors.result = "Result / Outcome is required.";
    }
    if (form.followUpRequired && !form.followUpNote?.trim()) {
      errors.followUpNote = "Follow-up note is required when follow-up is flagged.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSaving) return;

    const payload: CreateActionTakenPayload = {
      description: form.description.trim(),
      result: form.result.trim(),
      followUpRequired: form.followUpRequired,
      ...(form.followUpRequired && form.followUpNote?.trim()
        ? { followUpNote: form.followUpNote.trim() }
        : {}),
      ...(form.attachmentNotes?.trim()
        ? { attachmentNotes: form.attachmentNotes.trim() }
        : {}),
      ...(form.actionDateTime
        ? { actionDateTime: new Date(form.actionDateTime).toISOString() }
        : {}),
    };

    const submitted = await onSubmit(payload);

    if (submitted === false) return;

    // Refresh the list after a successful create; edits are updated in place.
    if (!isEditMode) {
      await onActionAdded?.();
      setForm(EMPTY_FORM);
      setValidationErrors({});
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      data-testid="action-taken-form"
      style={{
        backgroundColor: isEditMode ? "var(--zen-pale)" : "var(--zen-card)",
        border: `1px solid ${isEditMode ? "var(--zen-primary)" : "var(--zen-border)"}`,
        borderRadius: "var(--zen-radius-sm)",
        padding: "1.25rem",
      }}
    >
      <h6
        className="fw-bold mb-3 d-flex align-items-center gap-2"
        style={{ color: "var(--zen-primary)" }}
      >
        {isEditMode ? "✏️ Edit Action Taken" : "➕ Log New Action Taken"}
      </h6>

      {/* Server-level submission error */}
      {submitError && (
        <div className="alert alert-danger py-2 small mb-3" role="alert" data-testid="action-form-error">
          {submitError}
        </div>
      )}

      <div className="row g-3">
        {/* Description (required) */}
        <div className="col-12">
          <label htmlFor="action-description" className="form-label fw-semibold small">
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="action-description"
            name="description"
            data-testid="action-description"
            className={`form-control${validationErrors.description ? " is-invalid" : ""}`}
            rows={3}
            placeholder="Describe the action taken…"
            value={form.description}
            onChange={handleChange}
            disabled={isSaving}
            required
          />
          {validationErrors.description && (
            <div className="invalid-feedback" data-testid="error-description">
              {validationErrors.description}
            </div>
          )}
        </div>

        {/* Result (required) */}
        <div className="col-12">
          <label htmlFor="action-result" className="form-label fw-semibold small">
            Result / Outcome <span className="text-danger">*</span>
          </label>
          <select
            id="action-result"
            name="result"
            data-testid="action-result"
            className={`form-select${validationErrors.result ? " is-invalid" : ""}`}
            value={form.result}
            onChange={handleChange}
            disabled={isSaving}
            required
          >
            {form.result === "" && (
              <option value="">Select a result…</option>
            )}
            {!["", "SUCCESS", "PARTIAL", "PENDING", "FAILED"].includes(form.result) && (
              <option value={form.result}>{form.result}</option>
            )}
            <option value="SUCCESS">SUCCESS</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
          </select>
          {validationErrors.result && (
            <div className="invalid-feedback" data-testid="error-result">
              {validationErrors.result}
            </div>
          )}
        </div>

        {/* Action Date/Time (optional — defaults to server-set now) */}
        <div className="col-12 col-md-6">
          <label htmlFor="action-datetime" className="form-label fw-semibold small">
            Action Date / Time <span className="text-muted fw-normal">(optional — defaults to now)</span>
          </label>
          <input
            id="action-datetime"
            name="actionDateTime"
            data-testid="action-datetime"
            type="datetime-local"
            className="form-control"
            value={form.actionDateTime ?? ""}
            onChange={handleChange}
            disabled={isSaving}
          />
        </div>

        {/* Attachment Notes (optional) */}
        <div className="col-12 col-md-6">
          <label htmlFor="action-attachment-notes" className="form-label fw-semibold small">
            Attachment Notes <span className="text-muted fw-normal">(optional)</span>
          </label>
          <input
            id="action-attachment-notes"
            name="attachmentNotes"
            data-testid="action-attachment-notes"
            type="text"
            className="form-control"
            placeholder="e.g. See attached screenshot…"
            value={form.attachmentNotes ?? ""}
            onChange={handleChange}
            disabled={isSaving}
          />
        </div>

        {/* Follow-Up Required (checkbox) */}
        <div className="col-12">
          <div className="form-check">
            <input
              id="action-follow-up-required"
              name="followUpRequired"
              data-testid="action-follow-up-required"
              type="checkbox"
              className="form-check-input"
              checked={form.followUpRequired}
              onChange={handleChange}
              disabled={isSaving}
              style={{ accentColor: "var(--zen-primary)" }}
            />
            <label
              htmlFor="action-follow-up-required"
              className="form-check-label fw-semibold small"
              style={{ color: form.followUpRequired ? "#92400E" : "inherit" }}
            >
              {form.followUpRequired
                ? "⚠️ Follow-Up Required"
                : "Follow-Up Required"}
            </label>
          </div>
        </div>

        {/* Follow-Up Note (conditional — required when checkbox is ticked) */}
        {form.followUpRequired && (
          <div className="col-12">
            <label htmlFor="action-follow-up-note" className="form-label fw-semibold small">
              Follow-Up Note <span className="text-danger">*</span>
            </label>
            <textarea
              id="action-follow-up-note"
              name="followUpNote"
              data-testid="action-follow-up-note"
              className={`form-control${validationErrors.followUpNote ? " is-invalid" : ""}`}
              rows={2}
              placeholder="Describe what follow-up action is needed…"
              value={form.followUpNote ?? ""}
              onChange={handleChange}
              disabled={isSaving}
              required
              style={{
                backgroundColor: "#FFFBEB",
                borderColor: validationErrors.followUpNote ? undefined : "#F59E0B",
              }}
            />
            {validationErrors.followUpNote && (
              <div className="invalid-feedback" data-testid="error-follow-up-note">
                {validationErrors.followUpNote}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="d-flex align-items-center gap-2 mt-3 flex-wrap">
        <button
          type="submit"
          className="btn btn-zen-primary btn-sm"
          data-testid="action-form-submit"
          disabled={isSaving}
        >
          {isSaving
            ? isEditMode ? "Saving…" : "Logging…"
            : isEditMode ? "Save Changes" : "Log Action"}
        </button>
        {isEditMode && onCancel && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            data-testid="action-form-cancel"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default ActionTakenForm;
