import React, { useState, useEffect } from "react";
import { useRequesterContext } from "../context/RequesterContext.js";
import { Ticket, getMyTickets } from "../api.js";

interface MyTicketsListProps {
  onViewTicket: (ticketId: string) => void;
  onCreateTicket: () => void;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  NEW:         { bg: "#EAF6EF", color: "#006B3C", label: "New" },
  OPEN:        { bg: "#e0f0ff", color: "#0066cc", label: "Open" },
  IN_PROGRESS: { bg: "#fff3cd", color: "#856404", label: "In Progress" },
  PENDING:     { bg: "#f8d7da", color: "#842029", label: "Pending" },
  RESOLVED:    { bg: "#d1e7dd", color: "#0a3622", label: "Resolved" },
  CLOSED:      { bg: "#e2e3e5", color: "#41464b", label: "Closed" },
};

const PRIORITY_BADGE: Record<string, { emoji: string; color: string }> = {
  LOW:    { emoji: "🟢", color: "#198754" },
  MEDIUM: { emoji: "🟡", color: "#856404" },
  HIGH:   { emoji: "🟠", color: "#d96b00" },
  URGENT: { emoji: "🔴", color: "#b02a37" },
};

export const MyTicketsList: React.FC<MyTicketsListProps> = ({ onViewTicket, onCreateTicket }) => {
  const { currentRequester } = useRequesterContext();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentRequester) {
      setIsLoading(false);
      return;
    }
    loadTickets();
  }, [currentRequester?.id]);

  async function loadTickets() {
    if (!currentRequester) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyTickets(currentRequester.id);
      setTickets(data);
    } catch (err: any) {
      console.error("Failed to load tickets:", err);
      setError(err.message || "Failed to load tickets. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!currentRequester) {
    return (
      <div className="card-zen p-5 text-center shadow-sm">
        <div className="fs-1 mb-3">👤</div>
        <h3 className="h5 text-zen-primary fw-bold">No Identity Selected</h3>
        <p className="text-muted">Please select a development requester identity to view tickets.</p>
      </div>
    );
  }

  return (
    <div className="card-zen shadow-sm" style={{ borderRadius: "0.875rem" }}>
      {/* Header */}
      <div
        className="p-4 d-flex align-items-center justify-content-between flex-wrap gap-3 border-bottom"
        style={{ borderColor: "#EAF6EF" }}
      >
        <div>
          <h2 className="h4 text-zen-primary fw-bold mb-1 d-flex align-items-center gap-2">
            <span>📋</span> My Support Tickets
          </h2>
          <p className="text-muted mb-0 small">
            Showing tickets submitted by <strong>{currentRequester.name}</strong>
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            id="btn-refresh-tickets"
            className="btn btn-sm btn-outline-secondary"
            onClick={loadTickets}
            disabled={isLoading}
            title="Refresh ticket list"
          >
            {isLoading ? "⟳" : "⟳"} Refresh
          </button>
          <button
            id="btn-create-new-ticket"
            className="btn btn-zen-primary btn-sm px-3 fw-semibold"
            onClick={onCreateTicket}
          >
            + Create New Ticket
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {isLoading ? (
          <div className="py-5 text-center">
            <div className="spinner-border text-zen-primary mb-3" role="status">
              <span className="visually-hidden">Loading tickets...</span>
            </div>
            <p className="text-muted">Loading your tickets...</p>
          </div>
        ) : error ? (
          <div className="p-3">
            <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadTickets}>
              Try Again
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-5 text-center">
            <div className="fs-1 mb-3">🎫</div>
            <h5 className="text-muted fw-semibold">No tickets yet</h5>
            <p className="text-muted small mb-4">
              You haven't submitted any support tickets. Create your first one to get started.
            </p>
            <button className="btn btn-zen-primary px-4" onClick={onCreateTicket}>
              + Create First Ticket
            </button>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2 py-1">
            {tickets.map((ticket) => {
              const statusConfig = STATUS_BADGE[ticket.currentStatus] || STATUS_BADGE.NEW;
              const priorityConfig = PRIORITY_BADGE[ticket.requestedPriority] || PRIORITY_BADGE.MEDIUM;
              const attachCount = ticket.attachments?.length ?? 0;

              return (
                <div
                  key={ticket.id}
                  id={`ticket-row-${ticket.id}`}
                  className="card border p-3 d-flex flex-row align-items-center justify-content-between gap-3 bg-white"
                  style={{
                    borderRadius: "0.625rem",
                    borderColor: "#e0ece6",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                  }}
                  onClick={() => onViewTicket(ticket.id)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,107,60,0.12)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#006B3C";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#e0ece6";
                  }}
                >
                  {/* Left: Ticket Info */}
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <span className="fw-bold text-zen-primary small font-monospace">
                        {ticket.ticketNumber}
                      </span>
                      <span
                        className="badge fw-semibold"
                        style={{
                          background: statusConfig.bg,
                          color: statusConfig.color,
                          fontSize: "0.7rem",
                        }}
                      >
                        {statusConfig.label}
                      </span>
                      <span className="small">
                        {priorityConfig.emoji}{" "}
                        <span style={{ color: priorityConfig.color, fontWeight: 600 }}>
                          {ticket.requestedPriority}
                        </span>
                      </span>
                    </div>
                    <div className="fw-semibold text-dark mb-1 text-truncate" style={{ maxWidth: 480 }}>
                      {ticket.summary}
                    </div>
                    <div className="d-flex align-items-center gap-3 text-muted" style={{ fontSize: "0.75rem" }}>
                      <span>📁 {ticket.category?.name || "N/A"}</span>
                      {ticket.relatedSystem && <span>🖥️ {ticket.relatedSystem.name}</span>}
                      {attachCount > 0 && <span>📎 {attachCount} file{attachCount !== 1 ? "s" : ""}</span>}
                      <span>🕒 {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <div className="flex-shrink-0">
                    <button
                      id={`btn-view-ticket-${ticket.id}`}
                      className="btn btn-sm btn-zen-outline fw-semibold px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewTicket(ticket.id);
                      }}
                    >
                      View →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {!isLoading && !error && tickets.length > 0 && (
        <div
          className="px-4 py-2 border-top text-muted"
          style={{ fontSize: "0.78rem", borderColor: "#EAF6EF", borderRadius: "0 0 0.875rem 0.875rem" }}
        >
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} total
        </div>
      )}
    </div>
  );
};
