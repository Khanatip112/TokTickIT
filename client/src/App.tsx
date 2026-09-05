import { useState } from "react";
import { RequesterProvider, useRequesterContext } from "./context/RequesterContext";
import { Header } from "./components/Header";
import { CreateTicketForm } from "./components/CreateTicketForm";
import { MyTicketsList } from "./components/MyTicketsList";
import { TicketDetailView } from "./components/TicketDetailView";

function MainContent() {
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const { currentRequester } = useRequesterContext();

  const handleNavigateTab = (tab: "my-tickets" | "create-ticket") => {
    setActiveTab(tab);
    if (tab === "create-ticket") {
      setSelectedTicketId(null);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Header activeTab={activeTab} setActiveTab={handleNavigateTab} />

      <main className="container py-4 flex-grow-1" style={{ maxWidth: 960 }}>
        {/* Active Context Banner */}
        <div className="card-zen p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-sm">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-zen-pale text-zen-primary rounded-circle p-2 fs-5">
              👤
            </div>
            <div>
              <span className="text-muted small d-block">Active Development Identity Context</span>
              <strong className="fs-5 text-zen-primary">
                {currentRequester ? currentRequester.name : "No Requester Selected"}
              </strong>
              {currentRequester && (
                <span className="ms-2 text-muted small">
                  ({currentRequester.email} • {currentRequester.department || "No Department"})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation & View Content */}
        {selectedTicketId ? (
          <TicketDetailView
            ticketId={selectedTicketId}
            onBackToTickets={() => setSelectedTicketId(null)}
          />
        ) : activeTab === "create-ticket" ? (
          <CreateTicketForm
            onCancel={() => handleNavigateTab("my-tickets")}
            onSuccessRedirect={() => handleNavigateTab("my-tickets")}
          />
        ) : (
          <MyTicketsList
            onViewTicket={(ticketId) => setSelectedTicketId(ticketId)}
            onCreateTicket={() => handleNavigateTab("create-ticket")}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <RequesterProvider>
      <MainContent />
    </RequesterProvider>
  );
}