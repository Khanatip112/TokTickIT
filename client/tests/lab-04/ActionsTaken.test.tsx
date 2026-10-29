// @vitest-environment jsdom
/**
 * ActionsTaken.test.tsx โ€” Lab 4 Issue 4 UI Component Tests
 *
 * Requirements:
 * 1. Renders Actions Taken list correctly (Date/Time, Description, Result, Performed By, Follow-up Status/Note, Attachment Notes).
 * 2. Shows form for IT Staff/Admin, hides form for Requester (RBAC & Integration).
 * 3. Validates that followUpNote is required when followUpRequired checkbox is toggled.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActionsTakenList } from "../../src/components/actions-taken/ActionsTakenList.js";
import { ActionTakenForm } from "../../src/components/actions-taken/ActionTakenForm.js";
import { ActionsTakenSection } from "../../src/components/actions-taken/ActionsTakenSection.js";
//import { TicketDetail } from "../../src/pages/TicketDetail.js";
import * as api from "../../src/api.js";
import type { ActionTaken, CreateActionTakenPayload } from "../../src/api.js";

// โ”€โ”€ Fixtures โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

const mockAction: ActionTaken = {
  id: "act-001",
  ticketId: "tkt-999",
  actionDateTime: "2026-10-01T09:30:00.000Z",
  description: "Rebooted the mail server and cleared the queue.",
  result: "Mail flow resumed. No further errors observed.",
  performedById: "usr-staff-01",
  performedBy: { id: "usr-staff-01", name: "Alice Staff", email: "alice@toktick.it" },
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  createdAt: "2026-10-01T09:32:00.000Z",
  updatedAt: "2026-10-01T09:32:00.000Z",
};

const mockActionWithFollowUp: ActionTaken = {
  id: "act-002",
  ticketId: "tkt-999",
  actionDateTime: "2026-10-01T10:00:00.000Z",
  description: "Applied hotfix patch to network router.",
  result: "Latency normalized.",
  performedById: "usr-staff-02",
  performedBy: { id: "usr-staff-02", name: "Bob Engineer", email: "bob@toktick.it" },
  followUpRequired: true,
  followUpNote: "Check server logs in 48 hours.",
  attachmentNotes: "See attached diagnostic report.",
  createdAt: "2026-10-01T10:05:00.000Z",
  updatedAt: "2026-10-01T10:05:00.000Z",
};

// โ”€โ”€ 1. ActionsTakenList Tests โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

describe("ActionsTakenList โ€” rendering and presentation", () => {
  it("renders the empty state when no actions are provided", () => {
    render(<ActionsTakenList actions={[]} />);
    expect(screen.getByTestId("actions-taken-empty")).toBeInTheDocument();
    expect(screen.getByText(/No actions have been logged/i)).toBeInTheDocument();
  });

  it("renders a list of action-taken cards with date/time, description, result, and performer", () => {
    render(<ActionsTakenList actions={[mockAction, mockActionWithFollowUp]} />);
    const list = screen.getByTestId("actions-taken-list");
    expect(list).toBeInTheDocument();
    expect(screen.getByTestId(`action-item-${mockAction.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`action-item-${mockActionWithFollowUp.id}`)).toBeInTheDocument();

    expect(screen.getByText(/Rebooted the mail server and cleared the queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Mail flow resumed. No further errors observed/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice Staff \(alice@toktick.it\)/i)).toBeInTheDocument();

    expect(screen.getByText(/Applied hotfix patch to network router/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Engineer \(bob@toktick.it\)/i)).toBeInTheDocument();
  });

  it("renders follow-up badge and note for relevant actions", () => {
    render(<ActionsTakenList actions={[mockActionWithFollowUp]} />);
    expect(screen.getByText(/Follow-Up Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Check server logs in 48 hours/i)).toBeInTheDocument();
  });

  it("renders attachment notes when present", () => {
    render(<ActionsTakenList actions={[mockActionWithFollowUp]} />);
    expect(screen.getByText(/See attached diagnostic report/i)).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading is true", () => {
    render(<ActionsTakenList actions={[]} isLoading={true} />);
    expect(screen.getByTestId("actions-taken-loading")).toBeInTheDocument();
  });

  it("shows error banner when error prop is set", () => {
    render(<ActionsTakenList actions={[]} error="Network failure." />);
    expect(screen.getByTestId("actions-taken-error")).toBeInTheDocument();
    expect(screen.getByText(/Network failure/i)).toBeInTheDocument();
  });

  it("does NOT render Edit buttons when onEdit is not provided (read-only mode)", () => {
    render(<ActionsTakenList actions={[mockAction]} />);
    expect(screen.queryByTestId(`edit-action-${mockAction.id}`)).not.toBeInTheDocument();
  });

  it("DOES render Edit buttons and invokes onEdit when provided (Staff/Admin mode)", () => {
    const onEdit = vi.fn();
    render(<ActionsTakenList actions={[mockAction]} onEdit={onEdit} />);
    const editBtn = screen.getByTestId(`edit-action-${mockAction.id}`);
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockAction);
  });
});

// โ”€โ”€ 2. ActionTakenForm Tests โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

describe("ActionTakenForm โ€” form controls and states", () => {
  const noopSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form in create mode with all expected fields", () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    expect(screen.getByTestId("action-taken-form")).toBeInTheDocument();
    expect(screen.getByTestId("action-description")).toBeInTheDocument();
    expect(screen.getByTestId("action-result")).toBeInTheDocument();
    expect(screen.getByTestId("action-follow-up-required")).toBeInTheDocument();
    expect(screen.getByTestId("action-attachment-notes")).toBeInTheDocument();
    expect(screen.getByTestId("action-form-submit")).toBeInTheDocument();
    expect(screen.queryByTestId("action-follow-up-note")).not.toBeInTheDocument();
  });

  it("renders form in edit mode pre-populated with action values", () => {
    render(<ActionTakenForm editingAction={mockAction} onSubmit={noopSubmit} onCancel={vi.fn()} />);
    expect(screen.getByText(/Edit Action Taken/i)).toBeInTheDocument();
    expect(screen.getByTestId("action-form-cancel")).toBeInTheDocument();
    const descField = screen.getByTestId("action-description") as HTMLTextAreaElement;
    expect(descField.value).toBe(mockAction.description);
    const resultField = screen.getByTestId("action-result") as HTMLTextAreaElement;
    expect(resultField.value).toBe(mockAction.result);
  });

  it("calls onCancel when Cancel button is clicked in edit mode", () => {
    const onCancel = vi.fn();
    render(<ActionTakenForm editingAction={mockAction} onSubmit={noopSubmit} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("action-form-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables all controls when isSaving is true", () => {
    render(<ActionTakenForm onSubmit={noopSubmit} isSaving={true} />);
    expect(screen.getByTestId("action-description")).toBeDisabled();
    expect(screen.getByTestId("action-result")).toBeDisabled();
    expect(screen.getByTestId("action-form-submit")).toBeDisabled();
  });

  it("shows submitError banner when provided", () => {
    render(<ActionTakenForm onSubmit={noopSubmit} submitError="Server error occurred." />);
    expect(screen.getByTestId("action-form-error")).toBeInTheDocument();
    expect(screen.getByText(/Server error occurred/i)).toBeInTheDocument();
  });
});

// โ”€โ”€ 3. Client-Side Validation Tests โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

describe("ActionTakenForm โ€” client-side validation", () => {
  const noopSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error when description is empty on submit", async () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "SUCCESS" } });
    fireEvent.click(screen.getByTestId("action-form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("error-description")).toBeInTheDocument();
      expect(screen.getByText(/Description is required/i)).toBeInTheDocument();
    });
    expect(noopSubmit).not.toHaveBeenCalled();
  });

  it("shows error when result is empty on submit", async () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    await userEvent.type(screen.getByTestId("action-description"), "Some description");
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("action-form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("error-result")).toBeInTheDocument();
      expect(screen.getByText(/Result \/ Outcome is required/i)).toBeInTheDocument();
    });
    expect(noopSubmit).not.toHaveBeenCalled();
  });

  it("shows followUpNote field when followUpRequired checkbox is checked", async () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    expect(screen.queryByTestId("action-follow-up-note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("action-follow-up-required"));
    await waitFor(() => {
      expect(screen.getByTestId("action-follow-up-note")).toBeInTheDocument();
    });
  });

  it("validates that followUpNote is required when followUpRequired checkbox is toggled", async () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    await userEvent.type(screen.getByTestId("action-description"), "Test description");
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "SUCCESS" } });
    fireEvent.click(screen.getByTestId("action-follow-up-required"));
    await waitFor(() => expect(screen.getByTestId("action-follow-up-note")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("action-form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("error-follow-up-note")).toBeInTheDocument();
      expect(screen.getByText(/Follow-up note is required/i)).toBeInTheDocument();
    });
    expect(noopSubmit).not.toHaveBeenCalled();
  });

  it("hides followUpNote field when followUpRequired checkbox is unchecked", async () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    const checkbox = screen.getByTestId("action-follow-up-required");
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByTestId("action-follow-up-note")).toBeInTheDocument());
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.queryByTestId("action-follow-up-note")).not.toBeInTheDocument();
    });
  });

  it("submits valid payload when required fields are filled without follow-up", async () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    await userEvent.type(screen.getByTestId("action-description"), "Cleared the cache.");
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "SUCCESS" } });
    fireEvent.click(screen.getByTestId("action-form-submit"));
    await waitFor(() => {
      expect(noopSubmit).toHaveBeenCalledWith(
        expect.objectContaining<Partial<CreateActionTakenPayload>>({
          description: "Cleared the cache.",
          result: "SUCCESS",
          followUpRequired: false,
        })
      );
    });
  });

  it("submits with followUpNote when followUpRequired is checked and note is filled", async () => {
    render(<ActionTakenForm onSubmit={noopSubmit} />);
    await userEvent.type(screen.getByTestId("action-description"), "Restarted the service.");
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "SUCCESS" } });
    fireEvent.click(screen.getByTestId("action-follow-up-required"));
    await waitFor(() => expect(screen.getByTestId("action-follow-up-note")).toBeInTheDocument());
    await userEvent.type(screen.getByTestId("action-follow-up-note"), "Monitor for 24h.");
    fireEvent.click(screen.getByTestId("action-form-submit"));
    await waitFor(() => {
      expect(noopSubmit).toHaveBeenCalledWith(
        expect.objectContaining<Partial<CreateActionTakenPayload>>({
          description: "Restarted the service.",
          result: "SUCCESS",
          followUpRequired: true,
          followUpNote: "Monitor for 24h.",
        })
      );
    });
  });
});

// โ”€โ”€ 4. RBAC & TicketDetail Integration Tests โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

describe("ActionsTakenSection โ€” RBAC and role visibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getActionsTaken").mockResolvedValue([mockAction]);
  });

  it("shows form and edit buttons for IT_STAFF", async () => {
    render(<ActionsTakenSection ticketId="tkt-999" userRole="IT_STAFF" />);

    // Wait for list to load
    await waitFor(() => {
      expect(screen.getByTestId("actions-taken-list")).toBeInTheDocument();
    });

    // Form should be rendered for IT_STAFF
    expect(screen.getByTestId("action-taken-form")).toBeInTheDocument();
    expect(screen.getByTestId("action-form-submit")).toBeInTheDocument();

    // Edit button should be visible in the list
    expect(screen.getByTestId(`edit-action-${mockAction.id}`)).toBeInTheDocument();

    // Read-only badge should NOT be present
    expect(screen.queryByText("Read-Only")).not.toBeInTheDocument();
  });

  it("shows form and edit buttons for ADMINISTRATOR", async () => {
    render(<ActionsTakenSection ticketId="tkt-999" userRole="ADMINISTRATOR" />);

    await waitFor(() => {
      expect(screen.getByTestId("actions-taken-list")).toBeInTheDocument();
    });

    // Form should be rendered for ADMINISTRATOR
    expect(screen.getByTestId("action-taken-form")).toBeInTheDocument();
    expect(screen.getByTestId(`edit-action-${mockAction.id}`)).toBeInTheDocument();
    expect(screen.queryByText("Read-Only")).not.toBeInTheDocument();
  });

  it("hides form and edit buttons for REQUESTER (Read-Only mode)", async () => {
    render(<ActionsTakenSection ticketId="tkt-999" userRole="REQUESTER" />);

    await waitFor(() => {
      expect(screen.getByTestId("actions-taken-list")).toBeInTheDocument();
    });

    // Form must NOT be rendered for REQUESTER
    expect(screen.queryByTestId("action-taken-form")).not.toBeInTheDocument();

    // Edit button must NOT be rendered
    expect(screen.queryByTestId(`edit-action-${mockAction.id}`)).not.toBeInTheDocument();

    // Read-Only badge should be visible
    expect(screen.getByText("Read-Only")).toBeInTheDocument();
  });
});
