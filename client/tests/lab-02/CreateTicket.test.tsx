import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event"; // Use userEvent instead of fireEvent
import { CreateTicketForm } from "../../src/components/CreateTicketForm";
import * as api from "../../src/api";
import { RequesterProvider } from "../../src/context/RequesterContext";

// Fix 1: Update mock ids to strings and add missing 'code'
const mockCategories: api.Category[] = [
  { id: "1", name: "Hardware", description: "Hardware issues" },
  { id: "2", name: "Software", description: "Software issues" },
];

const mockSystems: api.RelatedSystem[] = [
  { id: "1", name: "Corporate Laptop", code: "LAP01", description: "Laptop device" },
];

const mockRequester: api.DevRequester = {
  id: "req-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@kmutt.ac.th",
  department: "Computer Engineering",
};

describe("CreateTicketForm Component", () => {
  beforeEach(() => {
    localStorage.setItem("toktickit_requester_id", "req-1");
    vi.restoreAllMocks();
    vi.spyOn(api, "getCategories").mockResolvedValue(mockCategories);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue(mockSystems);
    vi.spyOn(api, "getDevRequesters").mockResolvedValue([mockRequester]);
  });

  it("renders read-only requester info, initial status NEW, and form fields", async () => {
    render(
      <RequesterProvider>
        <CreateTicketForm onCancel={vi.fn()} onSuccessRedirect={vi.fn()} />
      </RequesterProvider>
    );

    expect(await screen.findByDisplayValue("NEW")).toBeInTheDocument();
    expect(screen.getByDisplayValue("(Auto-generated upon submission)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticket Summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Problem Description/i)).toBeInTheDocument();
  });

  it("displays validation errors when submitting invalid short summary", async () => {
    const user = userEvent.setup();
    render(
      <RequesterProvider>
        <CreateTicketForm onCancel={vi.fn()} onSuccessRedirect={vi.fn()} />
      </RequesterProvider>
    );

    await screen.findByDisplayValue("NEW");

    const summaryInput = screen.getByLabelText(/Ticket Summary/i);
    const descriptionInput = screen.getByLabelText(/Problem Description/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Support Ticket/i });

    // Fix 2: Use userEvent.type
    await user.type(summaryInput, "Bad");
    await user.type(descriptionInput, "Detailed problem description text.");
    await user.click(submitBtn);

    expect(await screen.findByText(/Summary must be at least 5 characters/i)).toBeInTheDocument();
  });

  it("submits valid ticket and renders success confirmation with ticket number", async () => {
    const user = userEvent.setup();

    // Fix 3: Fix Ticket mock interface conformity
    const mockCreatedTicket: api.Ticket = {
      id: "tkt-123",
      ticketNumber: "TKT-2026-000001",
      requesterId: "req-1",
      categoryId: "1",
      relatedSystemId: "1", // Added missing field
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining very fast after last update.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: { id: "1", name: "Hardware" }, // Fixed id type to string
      attachments: [],
    };

    vi.spyOn(api, "createTicket").mockResolvedValueOnce(mockCreatedTicket);

    render(
      <RequesterProvider>
        <CreateTicketForm onCancel={vi.fn()} onSuccessRedirect={vi.fn()} />
      </RequesterProvider>
    );

    await screen.findByDisplayValue("NEW");

    const summaryInput = screen.getByLabelText(/Ticket Summary/i);
    const descriptionInput = screen.getByLabelText(/Problem Description/i);
    const categorySelect = screen.getByLabelText(/Category/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Support Ticket/i });

    // Fix 4: Removed the hacky double fireEvent change and use userEvent.selectOptions
    await user.selectOptions(categorySelect, "1");
    await user.type(summaryInput, "Laptop battery drains quickly");
    await user.type(descriptionInput, "My laptop battery is draining very fast after last update.");

    await user.click(submitBtn);

    // Verify submission button enters loading state (optional, if your component supports this)
    // expect(submitBtn).toBeDisabled();

    expect(await screen.findByText(/Ticket Submitted Successfully/i)).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000001")).toBeInTheDocument();
  });

  // Suggested additional test: API error handling
  it("displays an error message when ticket submission fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createTicket").mockRejectedValueOnce(new Error("Network Error"));

    render(
      <RequesterProvider>
        <CreateTicketForm onCancel={vi.fn()} onSuccessRedirect={vi.fn()} />
      </RequesterProvider>
    );

    await screen.findByDisplayValue("NEW");

    await user.selectOptions(screen.getByLabelText(/Category/i), "1");
    await user.type(screen.getByLabelText(/Ticket Summary/i), "Valid summary");
    await user.type(screen.getByLabelText(/Problem Description/i), "Valid description");

    await user.click(screen.getByRole("button", { name: /Submit Support Ticket/i }));

    // Update the text matcher below to match whatever error UI your component actually renders
    expect(await screen.findByText(/Failed to create ticket/i)).toBeInTheDocument();
  });
});
