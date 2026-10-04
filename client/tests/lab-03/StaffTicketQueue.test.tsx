import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { StaffTicketQueue } from "../../src/pages/StaffTicketQueue";
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

const hardware: api.Category = { id: "cat-1", name: "Hardware" };
const software: api.Category = { id: "cat-2", name: "Software" };

const staffList: api.StaffUser[] = [
  { id: "s-1", name: "Michael Brown", email: "michael.brown@toktickit.com", role: "IT_STAFF" },
  { id: "s-2", name: "Sarah Connor", email: "sarah.connor@toktickit.com", role: "ADMINISTRATOR" },
];

function makeTicket(index: number, overrides: Partial<api.StaffTicket> = {}): api.StaffTicket {
  return {
    id: `tkt-${index}`,
    ticketNumber: `TKT-2026-${String(index).padStart(6, "0")}`,
    summary: `Ticket summary ${index}`,
    description: "Description",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "NEW",
    createdAt: "2026-05-12T09:14:00.000Z",
    updatedAt: "2026-05-12T09:14:00.000Z",
    category: hardware,
    relatedSystem: { id: "sys-1", name: "Email Gateway" },
    requester: { id: "req-1", name: "Jennifer Anderson", email: "jennifer.anderson@kmutt.ac.th" },
    owner: null,
    activeAttachmentsCount: 0,
    publicCommentsCount: 0,
    internalNotesCount: 0,
    ...overrides,
  };
}

const page1Tickets = [1, 2, 3].map((i) => makeTicket(i));

const firstPage: api.StaffTicketListResponse = {
  data: page1Tickets,
  pagination: {
    totalCount: 25,
    page: 1,
    pageSize: 10,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: false,
  },
};

const secondPage: api.StaffTicketListResponse = {
  data: [11, 12].map((i) => makeTicket(i)),
  pagination: {
    totalCount: 25,
    page: 2,
    pageSize: 10,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: true,
  },
};

const emptyPage: api.StaffTicketListResponse = {
  data: [],
  pagination: { totalCount: 0, page: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
};

function renderQueue(onViewTicket = vi.fn()) {
  render(
    <AuthProvider>
      <StaffTicketQueue onViewTicket={onViewTicket} />
    </AuthProvider>
  );
  return onViewTicket;
}

/** Params captured from the most recent `getStaffTickets` call. */
function lastCallParams(): api.StaffQueueParams | undefined {
  const mock = vi.mocked(api.getStaffTickets);
  return mock.mock.calls[mock.mock.calls.length - 1]?.[0];
}

describe("StaffTicketQueue Screen (/staff/queue)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/staff/queue");
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(staffUser);
    vi.spyOn(api, "getCategories").mockResolvedValue([hardware, software]);
    vi.spyOn(api, "getStaffUsers").mockResolvedValue(staffList);
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(firstPage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the desktop table with ticket numbers, badges, category, and owner", async () => {
    renderQueue();

    const table = await screen.findByTestId("queue-table");
    const rows = within(table).getAllByTestId("queue-row");
    expect(rows).toHaveLength(3);

    expect(within(table).getByText("TKT-2026-000001")).toBeInTheDocument();
    expect(within(table).getByText("Ticket summary 2")).toBeInTheDocument();
    // Category column (all seeded rows are Hardware)
    expect(within(rows[0]).getByText("Hardware")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Hardware")).toBeInTheDocument();

    // Status + priority badges (ui-spec §3.1 / §3.2)
    expect(within(table).getAllByText("New").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Medium").length).toBeGreaterThan(0);

    // Unassigned owner renders explicitly
    expect(within(table).getAllByText("Unassigned").length).toBe(3);

    // Sortable column headers
    expect(within(table).getByRole("columnheader", { name: /Ticket No/ })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /IT Priority/ })).toBeInTheDocument();
  });

  it("renders the mobile card list with all required fields", async () => {
    renderQueue();

    const cards = await screen.findByTestId("queue-cards");
    expect(within(cards).getAllByTestId("queue-card")).toHaveLength(3);

    const first = within(cards).getAllByTestId("queue-card")[0];
    expect(within(first).getByText("TKT-2026-000001")).toBeInTheDocument();
    expect(within(first).getByText("Ticket summary 1")).toBeInTheDocument();
    expect(within(first).getByText(/Category: Hardware/)).toBeInTheDocument();
    expect(within(first).getByText(/Requester: Jennifer Anderson/)).toBeInTheDocument();
    expect(within(first).getByText(/Owner: Unassigned/)).toBeInTheDocument();
    expect(within(first).getByText(/Created:/)).toBeInTheDocument();
    expect(within(first).getByText("View Detail ›")).toBeInTheDocument();
  });

  it("shows the assigned owner name for tickets that have one", async () => {
    vi.mocked(api.getStaffTickets).mockResolvedValue({
      ...firstPage,
      data: [makeTicket(1, { owner: staffList[0] })],
      pagination: { ...firstPage.pagination, totalCount: 1, totalPages: 1 },
    });

    renderQueue();

    const table = await screen.findByTestId("queue-table");
    expect(within(table).getByText("Michael Brown")).toBeInTheDocument();
    expect(within(table).queryByText("Unassigned")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while the queue request is in flight", async () => {
    vi.mocked(api.getStaffTickets).mockReturnValue(new Promise(() => {}));

    renderQueue();

    expect(await screen.findByTestId("queue-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("queue-skeleton-mobile")).toBeInTheDocument();
    expect(screen.queryByTestId("queue-table")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no tickets and no filters", async () => {
    vi.mocked(api.getStaffTickets).mockResolvedValue(emptyPage);

    renderQueue();

    expect(await screen.findByTestId("queue-empty")).toBeInTheDocument();
    expect(screen.getByText("No tickets in queue")).toBeInTheDocument();
    expect(screen.getByText("Showing 0 to 0 of 0 tickets")).toBeInTheDocument();
    // Toolbar Clear Filters stays disabled when nothing is active.
    expect(screen.getByRole("button", { name: /Clear Filters/i })).toBeDisabled();
  });

  it("shows a no-results state with a Clear Filters action when a filter is active", async () => {
    vi.mocked(api.getStaffTickets).mockResolvedValue(emptyPage);
    const user = userEvent.setup();
    renderQueue();

    await screen.findByTestId("queue-empty");

    await user.selectOptions(screen.getByLabelText("Filter by status"), "IN_PROGRESS");

    expect(await screen.findByText("No tickets match your search filters")).toBeInTheDocument();
    expect(lastCallParams()?.status).toBe("IN_PROGRESS");

    // Two Clear Filters buttons exist here (toolbar + empty state).
    const emptyPanel = screen.getByTestId("queue-empty");
    await user.click(within(emptyPanel).getByRole("button", { name: /Clear Filters/i }));
    await waitFor(() => expect(lastCallParams()?.status).toBeUndefined());
  });

  it("surfaces a load failure as an error banner", async () => {
    vi.mocked(api.getStaffTickets).mockRejectedValue(new Error("Network is down"));

    renderQueue();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network is down");
  });

  it("still renders when the staff lookup fails", async () => {
    vi.mocked(api.getStaffUsers).mockRejectedValue(new Error("nope"));

    renderQueue();

    const table = await screen.findByTestId("queue-table");
    expect(within(table).getAllByTestId("queue-row")).toHaveLength(3);
    const ownerFilter = screen.getByLabelText("Filter by owner") as HTMLSelectElement;
    expect(within(ownerFilter).queryByRole("option", { name: "Sarah Connor" })).not.toBeInTheDocument();
    expect(within(ownerFilter).getByRole("option", { name: "Assigned to Me" })).toBeInTheDocument();
  });

  it("debounces the search box and sends it as the search param", async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByTestId("queue-table");

    await user.type(screen.getByLabelText(/Search by ticket number or summary/i), "battery");

    await waitFor(() => expect(lastCallParams()?.search).toBe("battery"), { timeout: 2000 });
    // The debounced value must not fire a request per keystroke.
    expect(vi.mocked(api.getStaffTickets).mock.calls.length).toBeLessThan(8);
  });

  it("applies category, status, IT priority, and owner filters", async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByTestId("queue-table");

    await user.selectOptions(screen.getByLabelText("Filter by category"), "cat-2");
    await waitFor(() => expect(lastCallParams()?.categoryId).toBe("cat-2"));

    await user.selectOptions(screen.getByLabelText("Filter by status"), "PENDING");
    await waitFor(() => expect(lastCallParams()?.status).toBe("PENDING"));

    await user.selectOptions(screen.getByLabelText("Filter by IT priority"), "HIGH");
    await waitFor(() => expect(lastCallParams()?.itPriority).toBe("HIGH"));

    await user.selectOptions(screen.getByLabelText("Filter by owner"), "me");
    await waitFor(() => expect(lastCallParams()?.ownerId).toBe("me"));

    await user.selectOptions(screen.getByLabelText("Filter by owner"), "unassigned");
    await waitFor(() => expect(lastCallParams()?.ownerId).toBe("unassigned"));

    await user.selectOptions(screen.getByLabelText("Filter by owner"), "s-2");
    await waitFor(() => expect(lastCallParams()?.ownerId).toBe("s-2"));
  });

  it("clears every filter and restores the default query", async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByTestId("queue-table");

    await user.type(screen.getByLabelText(/Search by ticket number or summary/i), "printer");
    await user.selectOptions(screen.getByLabelText("Filter by status"), "OPEN");
    await user.selectOptions(screen.getByLabelText("Filter by owner"), "me");
    await waitFor(() => expect(lastCallParams()?.ownerId).toBe("me"), { timeout: 2000 });

    await user.click(screen.getByRole("button", { name: /Clear Filters/i }));

    await waitFor(
      () => {
        const params = lastCallParams();
        expect(params?.search).toBeUndefined();
        expect(params?.status).toBeUndefined();
        expect(params?.ownerId).toBeUndefined();
        expect(params?.categoryId).toBeUndefined();
        expect(params?.itPriority).toBeUndefined();
      },
      { timeout: 2000 }
    );
    expect(screen.getByLabelText(/Search by ticket number or summary/i)).toHaveValue("");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Clear Filters/i })).toBeDisabled()
    );
  });

  it("sorts by ticket number and toggles the sort direction", async () => {
    renderQueue();
    await screen.findByTestId("queue-table");

    const header = screen.getByRole("columnheader", { name: /Ticket No/ });
    const user = userEvent.setup();

    await user.click(header);
    await waitFor(() => {
      expect(lastCallParams()?.sortBy).toBe("ticketNumber");
      expect(lastCallParams()?.sortOrder).toBe("desc");
    });

    // The table is swapped for a skeleton while the new sort loads.
    await waitFor(() => expect(screen.getByTestId("queue-table")).toBeInTheDocument(), {
      timeout: 2000,
    });

    const secondHeader = screen.getByRole("columnheader", { name: /Ticket No/ });
    await user.click(secondHeader);
    await waitFor(() => expect(lastCallParams()?.sortOrder).toBe("asc"));
  });

  it("requests the correct page from pagination controls", async () => {
    renderQueue();
    await screen.findByTestId("queue-table");

    expect(screen.getByText("Showing 1 to 10 of 25 tickets")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTestId("page-2"));
    await waitFor(() => expect(lastCallParams()?.page).toBe(2));

    await user.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(lastCallParams()?.page).toBe(3));
  });

  it("disables Previous on the first page", async () => {
    renderQueue();
    await screen.findByTestId("queue-table");

    const previous = screen.getByRole("button", { name: /Previous/ });
    expect(previous).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();
  });

  it("navigates to the ticket detail from a table row", async () => {
    const onViewTicket = renderQueue();
    const table = await screen.findByTestId("queue-table");
    const row = within(table).getAllByTestId("queue-row")[0];

    await userEvent.click(row);
    expect(onViewTicket).toHaveBeenCalledWith("tkt-1");
  });

  it("navigates to the ticket detail from a mobile card", async () => {
    const onViewTicket = renderQueue();
    const cards = await screen.findByTestId("queue-cards");

    await userEvent.click(within(cards).getAllByTestId("queue-card")[1]);
    expect(onViewTicket).toHaveBeenCalledWith("tkt-2");
  });
});
