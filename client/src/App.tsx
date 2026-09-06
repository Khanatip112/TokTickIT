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

    setSelectedTicketId(null);

  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Header activeTab={activeTab} setActiveTab={handleNavigateTab} />

      {/* เปลี่ยนเป็น container-fluid px-4 และปลดล็อค maxWidth ออกเพื่อให้ขยายเต็มจอ */}
      <main className="container-fluid px-4 py-4 flex-grow-1">
        {/* Active Context Banner */}
        <div className="card-zen p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-sm">
          <div className="d-flex align-items-center gap-3 min-w-0 w-100">
            <div className="bg-zen-pale text-zen-primary rounded-circle p-2 fs-5 flex-shrink-0">
              👤
            </div>
            <div className="min-w-0 flex-grow-1">
              <span className="text-muted small d-block">Active Development Identity Context</span>
              <strong className="fs-5 text-zen-primary d-block d-sm-inline">
                {currentRequester ? currentRequester.name : "No Requester Selected"}
              </strong>
              {currentRequester && (
                <span className="ms-0 ms-sm-2 text-muted small d-block d-sm-inline text-break">
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