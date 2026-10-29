import React, { useCallback, useEffect, useState } from "react";
import {
  ActionTaken,
  CreateActionTakenPayload,
  ApiError,
  getActionsTaken,
  createActionTaken,
  updateActionTaken,
} from "../../api.js";
import { ActionsTakenList } from "./ActionsTakenList.js";
import { ActionTakenForm } from "./ActionTakenForm.js";
import { UserRole } from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";

export interface ActionsTakenSectionProps {
  ticketId: string;
  userRole?: UserRole;
}

/**
 * ActionsTakenSection — Lab 4 Issue 4 (Orchestrator)
 *
 * Wires together ActionsTakenList and ActionTakenForm into a cohesive section:
 *  - IT_STAFF / ADMINISTRATOR: full create + inline edit flow.
 *  - REQUESTER: read-only list, no form, no edit buttons.
 *
 * All API calls are handled here; child components are purely presentational.
 */
export const ActionsTakenSection: React.FC<ActionsTakenSectionProps> = ({
  ticketId,
  userRole: propRole,
}) => {
  let contextRole: UserRole | undefined;
  try {
    const auth = useAuth();
    contextRole = auth?.user?.role;
  } catch {
    // context not available in isolated test
  }
  const role = propRole || contextRole || "REQUESTER";
  const canManage = role === "IT_STAFF" || role === "ADMINISTRATOR";

  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingAction, setEditingAction] = useState<ActionTaken | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  /** Loads / reloads the actions-taken list from the API. */
  const loadActions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await getActionsTaken(ticketId);
      setActions(Array.isArray(list) ? list : ((list as { data?: ActionTaken[] })?.data ?? []));
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load actions taken."
      );
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  /** Handles form submission for both create and update flows. */
  const handleFormSubmit = async (payload: CreateActionTakenPayload): Promise<boolean> => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      if (editingAction) {
        const updated = await updateActionTaken(editingAction.id, payload);
        setActions((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
        setSaveSuccess("Action updated successfully.");
        setEditingAction(null);
        return true;
      } else {
        await createActionTaken(ticketId, payload);
        setSaveSuccess("Action logged successfully.");
        await loadActions();
        return true;
      }
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save action taken."
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (action: ActionTaken) => {
    setSaveSuccess(null);
    setSaveError(null);
    setEditingAction(action);
    // Scroll to form
    document.getElementById("actions-taken-form-anchor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleCancelEdit = () => {
    setEditingAction(null);
    setSaveError(null);
  };

  return (
    <section
      className="mt-4 pt-4 border-top"
      aria-labelledby="actions-taken-heading"
      data-testid="actions-taken-section"
    >
      {/* Section Header */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h5
          id="actions-taken-heading"
          className="fw-bold mb-0 d-flex align-items-center gap-2"
          style={{ color: "var(--zen-primary)" }}
        >
          <span>🛠️ Actions Taken</span>
          <span className="badge" style={{ backgroundColor: "var(--zen-primary)", color: "#fff", fontSize: "0.75rem" }}>
            {actions.length}
          </span>
        </h5>
        {!canManage && (
          <span
            className="badge"
            style={{
              backgroundColor: "var(--zen-readonly)",
              color: "var(--zen-muted)",
              border: "1px solid var(--zen-border)",
              fontSize: "0.72rem",
            }}
          >
            Read-Only
          </span>
        )}
      </div>

      {/* Success banner */}
      {saveSuccess && (
        <div
          className="alert py-2 small mb-3 d-flex align-items-center gap-2"
          role="status"
          data-testid="action-save-success"
          style={{
            backgroundColor: "var(--zen-pale)",
            border: "1px solid var(--zen-border)",
            color: "var(--zen-primary)",
          }}
        >
          ✅ {saveSuccess}
        </div>
      )}

      {/* Form — IT Staff / Admin only */}
      {canManage && (
        <div id="actions-taken-form-anchor" className="mb-4">
          <ActionTakenForm
            editingAction={editingAction}
            onSubmit={handleFormSubmit}
            onActionAdded={loadActions}
            onCancel={handleCancelEdit}
            isSaving={isSaving}
            submitError={saveError}
          />
        </div>
      )}

      {/* List — all roles (read-only for Requester, editable for Staff/Admin) */}
      <ActionsTakenList
        actions={actions}
        onEdit={canManage ? handleEdit : undefined}
        isLoading={isLoading}
        error={loadError}
      />
    </section>
  );
};

export default ActionsTakenSection;
