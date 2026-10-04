import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { StaffTicketDetail } from "../../src/pages/StaffTicketDetail";
import { TicketDetailView } from "../../src/components/TicketDetailView";
import { AuthProvider } from "../../src/context/AuthContext";
import * as api from "../../src/api";

const staffUser: api.AuthUser = {
  id: "s-1",
  name: "Michael Brown",
  email: "michael.brown@toktickit.com",
  role: "IT_STAFF",
  department: "IT Support",
  isActive: true,
  requiresPasswordChange: false,
};

const requesterUser: api.AuthUser = {
  id: "req-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@toktickit.com",
  role: "REQUESTER",
  department: "Marketing",
  isActive: true,
  requiresPasswordChange: false,
};

const hardware: api.Category = { id: "cat-1", name: "Hardware" };

const staffList: api.StaffUser[] = [
  { id: "s-1", name: "Michael Brown", email: "michael.brown@toktickit.com", role: "IT_STAFF" },
  { id: "s-2", name: "Sarah Connor", email: "sarah.connor@toktickit.com", role: "ADMINISTRATOR" },
];

function makeDetail(overrides: Partial<api.StaffTicketDetail> = {}): api.StaffTicketDetail {
  return {
    id: "tkt-1",
    ticketNumber: "TKT-2026-000123",
    summary: "Laptop battery drains quickly",
    description: "My laptop battery is draining much faster than usual.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "OPEN",
    createdAt: "2026-05-12T09:14:00.000Z",
    updatedAt: "2026-05-12T10:30:00.000Z",
    category: hardware,
    relatedSystem: { id: "sys-1", name: "Corporate Laptop" },
    requester: {
      id: "req-1",
      name: "Jennifer Anderson",
      email: "jennifer.anderson@toktickit.com",
      department: "Marketing",
    },
    owner: null,
    ownerId: null,
    activeAttachmentsCount: 0,
    publicCommentsCount: 0,
    internalNotesCount: 0,
    resolutionSummary: null,
    attachments: [],
    permittedTransitions: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    ...overrides,
  };
}

const operationResult: api.StaffTicketOperationResult = {
  id: "tkt-1",
  updatedAt: "2026-05-12T11:00:00.000Z",
};

function renderStaffDetail(ticketId = "tkt-1") {
  const onBackToQueue = vi.fn();
  render(
    <AuthProvider>
      <StaffTicketDetail ticketId={ticketId} onBackToQueue={onBackToQueue} />
    </AuthProvider>
  );
  return onBackToQueue;
}

describe("StaffTicketDetail Screen — IT Staff control panel (/staff/tickets/:id)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/staff/tickets/tkt-1");
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(staffUser);
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(makeDetail());
    vi.spyOn(api, "getStaffUsers").mockResolvedValue(staffList);
    vi.spyOn(api, "claimStaffTicket").mockResolvedValue(operationResult);
    vi.spyOn(api, "assignStaffTicket").mockResolvedValue(operationResult);
    vi.spyOn(api, "updateStaffTicketPriority").mockResolvedValue(operationResult);
    vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue(operationResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders read-only facts and Zen badges (read-only vs editable split)", async () => {
    renderStaffDetail();

    expect(await screen.findByTestId("staff-ticket-detail")).toBeInTheDocument();

    expect(screen.getByLabelText("Ticket No")).toHaveValue("TKT-2026-000123");
    expect(screen.getByLabelText("Requester")).toHaveValue(
      "Jennifer Anderson (jennifer.anderson@toktickit.com)"
    );
    expect(screen.getByText("Laptop battery drains quickly")).toBeInTheDocument();

    // Requested priority stays a read-only badge (BR-12).
    const requestedBadge = screen.getByTestId("requested-priority-badge");
    expect(within(requestedBadge).getByText("Medium")).toBeInTheDocument();
    expect(within(requestedBadge).queryByRole("combobox")).toBeNull();

    // Current status shown as a badge; the select only stages new transitions.
    expect(within(screen.getByTestId("current-status-badge")).getByText("Open")).toBeInTheDocument();
  });

  it("offers only the permitted BR-15 transitions in the status dropdown", async () => {
    const user = userEvent.setup();
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    await user.click(screen.getByLabelText("Change Status"));
    const options = within(screen.getByLabelText("Change Status")).getAllByRole("option");
    const values = options.map((option) => option.getAttribute("value"));

    expect(values).toEqual([
      "",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ]);
    // Not reachable from OPEN per the matrix.
    expect(values).not.toContain("CLOSED");
    expect(values).not.toContain("NEW");
  });

  it("claims an unassigned ticket via the Claim Ticket button", async () => {
    const user = userEvent.setup();
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    const claimButton = screen.getByRole("button", { name: "Claim Ticket" });
    await user.click(claimButton);

    await waitFor(() => expect(api.claimStaffTicket).toHaveBeenCalledWith("tkt-1"));
    await waitFor(() => expect(screen.getByTestId("staff-action-success")).toBeInTheDocument());
  });

  it("hides the claim button when the current user already owns the ticket", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(
      makeDetail({ owner: { id: "s-1", name: staffUser.name, email: staffUser.email }, ownerId: "s-1" })
    );
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    expect(screen.queryByTestId("claim-button")).toBeNull();
    expect(screen.getByLabelText("Ticket Owner")).toHaveValue("s-1");
  });

  it("reassigns the ticket through the owner dropdown", async () => {
    const user = userEvent.setup();
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "s-2");

    await waitFor(() => expect(api.assignStaffTicket).toHaveBeenCalledWith("tkt-1", "s-2"));
  });

  it("changes IT Priority without altering the Requester's requested priority", async () => {
    const user = userEvent.setup();
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    await user.selectOptions(screen.getByLabelText("IT Priority"), "URGENT");

    await waitFor(() =>
      expect(api.updateStaffTicketPriority).toHaveBeenCalledWith("tkt-1", "URGENT")
    );
    // The read-only requested priority badge is untouched.
    expect(
      within(screen.getByTestId("requested-priority-badge")).getByText("Medium")
    ).toBeInTheDocument();
  });

  it("requires a resolution summary before resolving (BR-17)", async () => {
    const user = userEvent.setup();
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    await user.selectOptions(screen.getByLabelText("Change Status"), "RESOLVED");
    const applyButton = await screen.findByRole("button", { name: "Apply Status Change" });
    await user.click(applyButton);

    // Blocked client-side: no API call, and the reason is surfaced.
    expect(api.updateStaffTicketStatus).not.toHaveBeenCalled();
    expect(await screen.findByTestId("staff-action-error")).toHaveTextContent(
      /resolution summary/i
    );

    // Supplying a valid summary unblocks the transition.
    await user.type(
      screen.getByLabelText("Resolution Summary"),
      "Replaced faulty battery cell and updated the driver."
    );
    await user.click(screen.getByRole("button", { name: "Apply Status Change" }));

    await waitFor(() =>
      expect(api.updateStaffTicketStatus).toHaveBeenCalledWith(
        "tkt-1",
        "RESOLVED",
        "Replaced faulty battery cell and updated the driver."
      )
    );
    await waitFor(() => expect(screen.getByTestId("staff-action-success")).toBeInTheDocument());
  });

  it("applies a transition that needs no resolution summary", async () => {
    const user = userEvent.setup();
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    await user.selectOptions(screen.getByLabelText("Change Status"), "IN_PROGRESS");
    await user.click(await screen.findByRole("button", { name: "Apply Status Change" }));

    await waitFor(() =>
      expect(api.updateStaffTicketStatus).toHaveBeenCalledWith("tkt-1", "IN_PROGRESS", undefined)
    );
  });

  it("offers an Assign to Me action when the ticket belongs to another staffer", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(
      makeDetail({ owner: { id: "s-2", name: "Sarah Connor", email: "sarah.connor@toktickit.com" }, ownerId: "s-2" })
    );
    renderStaffDetail();
    await screen.findByTestId("staff-ticket-detail");

    const claimButton = screen.getByRole("button", { name: "Assign to Me" });
    await user.click(claimButton);
    await waitFor(() => expect(api.claimStaffTicket).toHaveBeenCalledWith("tkt-1"));
  });

  it("shows an error state when the ticket cannot be loaded", async () => {
    vi.spyOn(api, "getStaffTicket").mockRejectedValue(
      new api.ApiError("Failed to load the ticket.", 500)
    );
    renderStaffDetail("missing");

    expect(await screen.findByTestId("staff-detail-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });
});

describe("TicketDetailView — Requester view (read-only badges + Problem Appears Resolved)", () => {
  function makeRequesterTicket(overrides: Partial<api.Ticket> = {}): api.Ticket {
    return {
      id: "tkt-r",
      ticketNumber: "TKT-2026-000456",
      requesterId: "req-1",
      categoryId: "cat-1",
      relatedSystemId: "sys-1",
      requestedPriority: "MEDIUM",
      currentStatus: "OPEN",
      summary: "Projector shows no signal",
      description: "The classroom projector shows no signal since this morning.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: hardware,
      relatedSystem: { id: "sys-1", name: "Classroom Projector", code: "PRJ-101" },
      requester: {
        id: "req-1",
        name: "Jennifer Anderson",
        email: "jennifer.anderson@toktickit.com",
      },
      attachments: [],
      ...overrides,
    };
  }

  function renderRequesterDetail(ticketId = "tkt-r") {
    render(
      <AuthProvider>
        <TicketDetailView ticketId={ticketId} />
      </AuthProvider>
    );
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(requesterUser);
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(makeRequesterTicket());
    vi.spyOn(api, "indicateProblemResolved").mockResolvedValue({
      message: "Resolution indication recorded successfully",
      ticketId: "tkt-r",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows read-only priority and status badges plus the indication action", async () => {
    renderRequesterDetail();

    expect(await screen.findByText("TKT-2026-000456")).toBeInTheDocument();

    // Read-only badges (no interactive controls for Requesters).
    expect(screen.getByText("Requested Priority")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByLabelText("IT Priority")).toBeNull();
    expect(screen.queryByLabelText("Change Status")).toBeNull();
    expect(screen.queryByTestId("claim-button")).toBeNull();

    expect(await screen.findByTestId("resolve-indication-card")).toBeInTheDocument();
  });

  it("records the indication after confirmation and leaves the status unchanged", async () => {
    const user = userEvent.setup();
    renderRequesterDetail();
    await screen.findByTestId("resolve-indication-card");

    await user.click(screen.getByRole("button", { name: "Problem Appears Resolved" }));

    // Confirmation modal copy from ui-spec §4.7.
    expect(
      screen.getByText(/Confirm that your issue has been resolved\. This will notify IT Staff/i)
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("confirm-resolve-indication"));

    await waitFor(() => expect(api.indicateProblemResolved).toHaveBeenCalledWith("tkt-r"));
    expect(await screen.findByTestId("resolution-indication-done")).toBeInTheDocument();

    // BR-16: status stays OPEN — no status mutation API exists for Requesters.
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByTestId("resolve-indication-card")).toBeNull();
  });

  it("surfaces an error when the indication fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "indicateProblemResolved").mockRejectedValue(
      new api.ApiError("A resolution indication cannot be recorded for a ticket with status RESOLVED.", 422)
    );
    renderRequesterDetail();
    await screen.findByTestId("resolve-indication-card");

    await user.click(screen.getByRole("button", { name: "Problem Appears Resolved" }));
    await user.click(screen.getByTestId("confirm-resolve-indication"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be recorded/i);
    expect(screen.getByTestId("resolve-indication-card")).toBeInTheDocument();
  });

  it("hides the indication action for non-active tickets", async () => {
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(
      makeRequesterTicket({ currentStatus: "NEW" })
    );
    renderRequesterDetail();

    await screen.findByText("TKT-2026-000456");
    expect(screen.queryByTestId("resolve-indication-card")).toBeNull();
    expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).toBeNull();
  });
});



