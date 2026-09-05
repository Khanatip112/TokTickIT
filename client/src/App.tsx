import { useState } from "react";
import { checkSystem, Category } from "./api";
import { RequesterProvider, useRequesterContext } from "./context/RequesterContext";
import { Header } from "./components/Header";
import { CreateTicketForm } from "./components/CreateTicketForm";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

function MainContent() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">("create-ticket");
  const { currentRequester } = useRequesterContext();

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");
    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to connect to TokTickIT API");
      setState("error");
    }
  }

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      {/* ส่งแค่ activeTab และ setActiveTab ตามที่ HeaderProps กำหนด */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="container py-4 flex-grow-1" style={{ maxWidth: 960 }}>
        {/* Active Context Banner */}
        <div className="card-zen p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
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

        {/* View Switcher */}
        {activeTab === "create-ticket" ? (
          <CreateTicketForm
            onCancel={() => setActiveTab("my-tickets")}
            onSuccessRedirect={() => setActiveTab("my-tickets")}
          />
        ) : (
          <div className="card-zen p-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <h2 className="h4 text-zen-primary fw-bold mb-1">My Support Tickets</h2>
                <p className="text-muted mb-0 small">View and track all tickets submitted under your requester identity.</p>
              </div>
              <button
                className="btn btn-zen-primary"
                onClick={() => setActiveTab("create-ticket")}
              >
                + Create New Ticket
              </button>
            </div>

            <div className="card-zen p-4 mb-4">
              <h1 className="h4 mb-3 text-zen-primary fw-bold">
                TokTickIT <span className="text-success">IT Service Desk MVP</span>
              </h1>

              <button className="btn btn-zen-primary mb-3" onClick={handleCheck} disabled={state === "loading"}>
                {state === "loading" ? "Loading…" : "Check System"}
              </button>

              {state === "success" && (
                <div className="mt-3">
                  <p className="fw-bold mb-3">
                    System Status: <span className="text-success">Online</span>
                  </p>
                  {categories.length > 0 && (
                    <div>
                      <p className="fw-bold mb-2">Supported Request Categories:</p>
                      <table className="table table-bordered table-striped mt-2">
                        <thead>
                          <tr>
                            <th scope="col" style={{ width: 220 }}>Category ID</th>
                            <th scope="col">Category Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((cat) => (
                            <tr key={cat.id}>
                              <td><code className="text-dark">{cat.id}</code></td>
                              <td>{cat.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {state === "error" && (
                <div className="mt-3">
                  <p className="fw-bold mb-1 text-danger">System Status: Offline</p>
                  <p className="text-muted">{errorMessage}</p>
                </div>
              )}
            </div>
          </div>
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