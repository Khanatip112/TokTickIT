import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketDetailView } from "../../src/components/TicketDetailView.js";
import * as api from "../../src/api.js";
import { AuthProvider } from "../../src/context/AuthContext.js";

const mockUser: api.AuthUser = {
  id: "req-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@kmutt.ac.th",
  role: "REQUESTER",
  department: "Computer Engineering",
  isActive: true,
  requiresPasswordChange: false,
};

const mockTicket: api.Ticket = {
  id: "tkt-123",
  ticketNumber: "TKT-2026-000123",
  requesterId: "req-1",
  categoryId: "cat-1",
  relatedSystemId: "sys-1",
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  summary: "Laptop battery drains quickly",
  description: "My laptop battery is draining very fast after last update.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  category: { id: "cat-1", name: "Hardware" },
  requester: {
    id: "req-1",
    name: "Jennifer Anderson",
    email: "jennifer.anderson@kmutt.ac.th",
    department: "Computer Engineering",
  },
  attachments: [
    {
      id: "att-1",
      ticketId: "tkt-123",
      fileName: "diagnostic_report.pdf",
      originalName: "diagnostic_report.pdf",
      filePath: "uploads/diagnostic_report.pdf",
      sizeBytes: 2048,
      mimeType: "application/pdf",
      isRemoved: false,
      createdAt: new Date().toISOString(),
    },
  ],
};

function renderDetail(ticketId: string) {
  return render(
    <AuthProvider>
      <TicketDetailView ticketId={ticketId} />
    </AuthProvider>
  );
}

describe("TicketDetailView Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(mockUser);
  });

  it("renders read-only ticket detail and active attachment download button", async () => {
    vi.spyOn(api, "getTicketDetail").mockResolvedValueOnce(mockTicket);

    renderDetail("tkt-123");

    expect(await screen.findByText("TKT-2026-000123")).toBeInTheDocument();
    expect(screen.getByText("Laptop battery drains quickly")).toBeInTheDocument();
    expect(screen.getByText("diagnostic_report.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download/i })).toBeInTheDocument();
  });

  it("displays 403 Forbidden state when user does not own ticket", async () => {
    const error403: any = new Error("Forbidden: You do not own this ticket");
    error403.status = 403;
    vi.spyOn(api, "getTicketDetail").mockRejectedValueOnce(error403);

    renderDetail("tkt-999");

    expect(await screen.findByText(/403 Forbidden - Access Denied/i)).toBeInTheDocument();
  });

  it("opens soft removal modal and requires removal reason", async () => {
    vi.spyOn(api, "getTicketDetail").mockResolvedValueOnce(mockTicket);

    renderDetail("tkt-123");

    expect(await screen.findByText("diagnostic_report.pdf")).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: /Soft Remove/i });
    fireEvent.click(removeBtn);

    expect(screen.getByText(/Confirm Attachment Soft Removal/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /Soft Remove Attachment/i });
    expect(confirmBtn).toBeDisabled();

    const reasonInput = screen.getByLabelText(/Reason for Removal/i);
    fireEvent.change(reasonInput, { target: { value: "Uploaded wrong document version" } });

    expect(confirmBtn).not.toBeDisabled();
  });
});
