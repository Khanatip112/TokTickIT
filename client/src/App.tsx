import { useState } from "react";
import { AuthProvider, needsPasswordChange, useAuth } from "./context/AuthContext.js";
import { Navigate, RouterProvider, useRouter } from "./router.js";
import { Header } from "./components/Header.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsList } from "./components/MyTicketsList.js";
import { TicketDetailView } from "./components/TicketDetailView.js";
import { Login } from "./pages/Login.js";
import { ChangePassword } from "./pages/ChangePassword.js";

function LoadingScreen() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="text-center">
        <div className="spinner-border text-zen-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
        <p className="mt-3 text-muted">Loading TokTickIT…</p>
      </div>
    </div>
  );
}

/** Authenticated application shell: header + requester ticket views. */
function AppShell() {
  const { path, navigate } = useRouter();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">(
    path === "/create-ticket" ? "create-ticket" : "my-tickets"
  );

  const handleNavigateTab = (tab: "my-tickets" | "create-ticket") => {
    setSelectedTicketId(null);
    setActiveTab(tab);
    navigate(tab === "create-ticket" ? "/create-ticket" : "/my-tickets");
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Header activeTab={activeTab} setActiveTab={handleNavigateTab} />

      <main className="container-fluid px-4 py-4 flex-grow-1">
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

/**
 * Top-level routing (Issue 4):
 * - `/login` is public (authenticated users are bounced to the app).
 * - Unauthenticated users are redirected to `/login`.
 * - Users flagged `requiresPasswordChange` are forced to `/change-password`.
 * - Everything else is wrapped in `ProtectedRoute`.
 */
function AppRoutes() {
  const { user, isLoading } = useAuth();
  const { path } = useRouter();

  if (isLoading) return <LoadingScreen />;

  if (path === "/login") {
    if (user && needsPasswordChange(user)) return <ChangePassword />;
    if (user) return <Navigate to="/" replace />;
    return <Login />;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (needsPasswordChange(user)) return <ChangePassword />;

  if (path === "/change-password") {
    return (
      <ProtectedRoute>
        <ChangePassword />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <AppRoutes />
      </RouterProvider>
    </AuthProvider>
  );
}
