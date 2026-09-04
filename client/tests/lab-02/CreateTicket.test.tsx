import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateTicketForm } from "../../src/components/CreateTicketForm.js";
import * as api from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";

const mockCategories: api.Category[] = [
  { id: "cat-1", name: "Hardware", description: "Hardware issues" },
  { id: "cat-2", name: "Software", description: "Software issues" },
];

const mockSystems: api.RelatedSystem[] = [
  { id: "sys-1", name: "Corporate Laptop", description: "Laptop device" },
];

const mockRequester: api.DevRequester = {
  id: "req-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@kmutt.ac.th",
  department: "Computer Engineering",
};

describe("CreateTicketForm Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getCategories").mockResolvedValue(mockCategories);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue(mockSystems);
    vi.spyOn(api, "getDevRequesters").mockResolvedValue([mockRequester]);
  });

  it("renders read-only requester info, initial status NEW, and form fields", async () => {
    render(
      <RequesterProvider>
        <CreateTicketForm />
      </RequesterProvider>
    );

    expect(await screen.findByDisplayValue("NEW")).toBeInTheDocument();
    expect(screen.getByDisplayValue("(Auto-generated upon submission)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticket Summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Problem Description/i)).toBeInTheDocument();
  });

  it("displays validation errors when submitting invalid short summary", async () => {
    render(
      <RequesterProvider>
        <CreateTicketForm />
      </RequesterProvider>
    );

    await screen.findByDisplayValue("NEW");

    const summaryInput = screen.getByLabelText(/Ticket Summary/i);
    const descriptionInput = screen.getByLabelText(/Problem Description/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Support Ticket/i });

    fireEvent.change(summaryInput, { target: { value: "Bad" } });
    fireEvent.change(descriptionInput, { target: { value: "Detailed problem description text." } });

    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Summary must be at least 5 characters/i)).toBeInTheDocument();
  });

  it("submits valid ticket and renders success confirmation with ticket number", async () => {
    const mockCreatedTicket: api.Ticket = {
      id: "tkt-123",
      ticketNumber: "TKT-2026-000001",
      requesterId: "req-1",
      categoryId: "cat-1",
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining very fast after last update.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: { id: "cat-1", name: "Hardware" },
      attachments: [],
    };

    vi.spyOn(api, "createTicket").mockResolvedValueOnce(mockCreatedTicket);

    render(
      <RequesterProvider>
        <CreateTicketForm />
      </RequesterProvider>
    );

    await screen.findByDisplayValue("NEW");

    const summaryInput = screen.getByLabelText(/Ticket Summary/i);
    const descriptionInput = screen.getByLabelText(/Problem Description/i);
    const submitBtn = screen.getByRole("button", { name: /Submit Support Ticket/i });

    fireEvent.change(summaryInput, { target: { value: "Laptop battery drains quickly" } });
    fireEvent.change(descriptionInput, { target: { value: "My laptop battery is draining very fast after last update." } });

    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Ticket Submitted Successfully/i)).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000001")).toBeInTheDocument();
  });
});
