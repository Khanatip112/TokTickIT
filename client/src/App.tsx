import { useState } from "react";
import { useRequesterContext } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsList } from "./components/MyTicketsList.js";
import { TicketDetailView } from "./components/TicketDetailView.js";
import { Ticket } from "./api.js";

type ViewState =
  | { view: "my-tickets" }
  | { view: "create-ticket" }
  | { view: "ticket-detail"; ticketId: string };

export default function App() {
  const { currentRequester, isLoading: isCtxLoading } = useRequesterContext();
  const [viewState, setViewState] = useState<ViewState>({ view: "my-tickets" });
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">("my-tickets");

  function handleTabChange(tab: "my-tickets" | "create-ticket") {
    setActiveTab(tab);
    setViewState({ view: tab });
  }

  function handleViewTicket(ticketId: string) {
    setViewState({ view: "ticket-detail", ticketId });
  }

  function handleBackToTickets() {
    setActiveTab("my-tickets");
    setViewState({ view: "my-tickets" });
  }

  function handleCreateSuccess(ticket: Ticket) {
    // Navigate to the newly created ticket's detail view
    setViewState({ view: "ticket-detail", ticketId: ticket.id });
  }

  function handleCreateCancel() {
    setActiveTab("my-tickets");
    setViewState({ view: "my-tickets" });
  }

  if (isCtxLoading) {
    return (
      <div
        className="d-flex align-items-center justify-content-center min-vh-100"
        style={{ background: "linear-gradient(135deg, #EAF6EF 0%, #f8fffe 100%)" }}
      >
        <div className="text-center">
          <div className="spinner-border text-zen-primary mb-3" style={{ width: "2.5rem", height: "2.5rem" }} role="status">
            <span className="visually-hidden">Loading identity context...</span>
          </div>
          <p className="text-muted fw-semibold">Loading TokTickIT...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100" style={{ background: "#f6faf8" }}>
      {/* Sticky Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      {/* Main Content */}
      <main
        className="flex-grow-1 py-4 px-3"
        style={{ maxWidth: 960, width: "100%", margin: "0 auto" }}
      >
        {/* Active Context Banner */}
        <div
          className="d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 mb-4 rounded-3 shadow-sm"
          style={{ background: "#EAF6EF", border: "1px solid rgba(0,107,60,0.15)" }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle fw-bold text-white flex-shrink-0"
              style={{ width: 44, height: 44, background: "#006B3C", fontSize: "1rem" }}
            >
              {currentRequester
                ? currentRequester.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                : "?"}
            </div>
            <div>
              <span className="text-muted small d-block" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
                ACTIVE DEVELOPMENT IDENTITY CONTEXT
              </span>
              <strong className="fs-6 text-zen-primary">
                {currentRequester ? currentRequester.name : "No Requester Selected"}
              </strong>
              {currentRequester && (
                <span className="ms-2 text-muted small">
                  {currentRequester.email}
                  {currentRequester.department ? ` · ${currentRequester.department}` : ""}
                </span>
              )}
            </div>
          </div>
          <div>
            <span
              className="badge fw-normal"
              style={{ background: "#d4edda", color: "#155724", fontSize: "0.75rem" }}
            >
              🔧 Dev Mode
            </span>
          </div>
        </div>

        {/* View Router */}
        {viewState.view === "my-tickets" && (
          <MyTicketsList
            onViewTicket={handleViewTicket}
            onCreateTicket={() => handleTabChange("create-ticket")}
          />
        )}

        {viewState.view === "create-ticket" && (
          <CreateTicketForm
            onSuccessRedirect={handleCreateSuccess}
            onCancel={handleCreateCancel}
          />
        )}

        {viewState.view === "ticket-detail" && (
          <TicketDetailView
            ticketId={viewState.ticketId}
            onBackToTickets={handleBackToTickets}
          />
        )}
      </main>
    </div>
  );
}
