import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTicketForm } from "../../src/components/CreateTicketForm";
import * as api from "../../src/api";
import { AuthProvider } from "../../src/context/AuthContext";

const mockCategories: api.Category[] = [
  { id: "1", name: "Hardware", description: "Hardware issues" },
  { id: "2", name: "Software", description: "Software issues" },
];

const mockSystems: api.RelatedSystem[] = [
  { id: "1", name: "Corporate Laptop", code: "LAP01", description: "Laptop device" },
];

const mockUser: api.AuthUser = {
  id: "req-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@kmutt.ac.th",
  role: "REQUESTER",
  department: "Computer Engineering",
  isActive: true,
  requiresPasswordChange: false,
};

function renderForm() {
  return render(
    <AuthProvider>
      <CreateTicketForm onCancel={vi.fn()} onSuccessRedirect={vi.fn()} />
    </AuthProvider>
  );
}

describe("CreateTicketForm Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(mockUser);
    vi.spyOn(api, "getCategories").mockResolvedValue(mockCategories);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue(mockSystems);
  });

  it("renders read-only requester info, initial status NEW, and form fields", async () => {
    renderForm();

    expect(await screen.findByDisplayValue("NEW")).toBeInTheDocument();
    expect(screen.getByDisplayValue("(Auto-generated upon submission)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticket Summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Problem Description/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Jennifer Anderson/i)).toBeInTheDocument();
  });

  it("displays validation errors when submitting invalid short summary", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByDisplayValue("NEW");

    const summaryInput = screen.getByLabelText(/Ticket Summary/i);
    const descriptionInput = screen.getByLabelText(/Problem Description/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Support Ticket/i });

    await user.type(summaryInput, "Bad");
    await user.type(descriptionInput, "Detailed problem description text.");
    await user.click(submitBtn);

    expect(await screen.findByText(/Summary must be at least 5 characters/i)).toBeInTheDocument();
  });

  it("submits valid ticket and renders success confirmation with ticket number", async () => {
    const user = userEvent.setup();

    const mockCreatedTicket: api.Ticket = {
      id: "tkt-123",
      ticketNumber: "TKT-2026-000001",
      requesterId: "req-1",
      categoryId: "1",
      relatedSystemId: "1",
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining very fast after last update.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: { id: "1", name: "Hardware" },
      attachments: [],
    };

    vi.spyOn(api, "createTicket").mockResolvedValueOnce(mockCreatedTicket);

    renderForm();

    await screen.findByDisplayValue("NEW");

    const summaryInput = screen.getByLabelText(/Ticket Summary/i);
    const descriptionInput = screen.getByLabelText(/Problem Description/i);
    const categorySelect = screen.getByLabelText(/Category/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Support Ticket/i });

    await user.selectOptions(categorySelect, "1");
    await user.type(summaryInput, "Laptop battery drains quickly");
    await user.type(descriptionInput, "My laptop battery is draining very fast after last update.");

    await user.click(submitBtn);

    expect(await screen.findByText(/Ticket Submitted Successfully/i)).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000001")).toBeInTheDocument();
  });

  it("displays an error message when ticket submission fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createTicket").mockRejectedValueOnce(new Error("Failed to create ticket"));

    renderForm();

    await screen.findByDisplayValue("NEW");

    await user.selectOptions(screen.getByLabelText(/Category/i), "1");
    await user.type(screen.getByLabelText(/Ticket Summary/i), "Valid summary");
    await user.type(screen.getByLabelText(/Problem Description/i), "Valid description");

    await user.click(screen.getByRole("button", { name: /Submit Support Ticket/i }));

    expect(await screen.findByText(/Failed to create ticket/i)).toBeInTheDocument();
  });
});
