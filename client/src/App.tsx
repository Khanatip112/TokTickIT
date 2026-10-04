import { useState } from "react";
import { AuthProvider, needsPasswordChange, useAuth } from "./context/AuthContext.js";
import { Navigate, RouterProvider, useRouter } from "./router.js";
import { Header } from "./components/Header.js";
import type { HeaderTab } from "./components/Header.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsList } from "./components/MyTicketsList.js";
import { TicketDetailView } from "./components/TicketDetailView.js";
import { Login } from "./pages/Login.js";
import { ChangePassword } from "./pages/ChangePassword.js";
import { UserManagement } from "./pages/UserManagement.js";
import { StaffTicketQueue } from "./pages/StaffTicketQueue.js";
import { StaffTicketDetail } from "./pages/StaffTicketDetail.js";

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

/** Maps a header navigation tab to its route. */
function pathForTab(tab: HeaderTab): string {
  if (tab === "admin") return "/admin/users";
  if (tab === "staff-queue") return "/staff/queue";
  if (tab === "create-ticket") return "/create-ticket";
  return "/my-tickets";
}

/** `true` when a role may access the IT Staff queue. */
function canAccessStaffQueue(role: string): boolean {
  return role === "IT_STAFF" || role === "ADMINISTRATOR";
}

/** 403 state shown when a non-Administrator opens the admin console (AC-21). */
function AccessDenied() {
  const { navigate } = useRouter();
  return (
    <main className="container py-5">
      <div className="card-zen p-5 text-center shadow-sm">
        <div className="fs-1 mb-2" aria-hidden="true">🛡️</div>
        <h2 className="h4 fw-bold text-danger mb-2">Access Denied</h2>
        <p className="text-secondary mb-4">You do not have permission to access this page or resource.</p>
        <button className="btn btn-zen-primary px-4" onClick={() => navigate("/")}>
          Return to Dashboard
        </button>
      </div>
    </main>
  );
}

/** Administrator console shell (`/admin/users`). */
function AdminShell() {
  const { navigate } = useRouter();
  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Header activeTab="admin" setActiveTab={(tab) => navigate(pathForTab(tab))} />
      <main className="container-fluid px-4 py-4 flex-grow-1">
        <UserManagement />
      </main>
    </div>
  );
}

/** IT Staff ticket queue shell (`/staff/queue`). */
function StaffShell() {
  const { navigate } = useRouter();
  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Header activeTab="staff-queue" setActiveTab={(tab) => navigate(pathForTab(tab))} />
      <main className="container-fluid px-4 py-4 flex-grow-1">
        <StaffTicketQueue onViewTicket={(ticketId) => navigate(`/staff/tickets/${ticketId}`)} />
      </main>
    </div>
  );
}

/**
 * IT Staff ticket detail route (`/staff/tickets/:id`, Issue 7).
 * Header + operational control panel (ui-spec §4.5).
 */
function StaffTicketDetailShell({ ticketId }: { ticketId: string }) {
  const { navigate } = useRouter();
  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Header activeTab="staff-queue" setActiveTab={(tab) => navigate(pathForTab(tab))} />
      <main className="container-fluid px-4 py-4 flex-grow-1">
        <StaffTicketDetail ticketId={ticketId} onBackToQueue={() => navigate("/staff/queue")} />
      </main>
    </div>
  );
}

/** Authenticated application shell: header + requester ticket views. */
function AppShell() {
  const { path, navigate } = useRouter();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HeaderTab>(
    path === "/create-ticket" ? "create-ticket" : "my-tickets"
  );

  const handleNavigateTab = (tab: HeaderTab) => {
    setSelectedTicketId(null);
    setActiveTab(tab);
    navigate(pathForTab(tab));
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
  const { path, navigate } = useRouter();

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

  if (path === "/admin/users") {
    // AC-21: a non-Administrator must never reach the admin console.
    if (user.role !== "ADMINISTRATOR") {
      return (
        <div className="min-vh-100 d-flex flex-column bg-light">
          <Header activeTab="my-tickets" setActiveTab={(tab) => navigate(pathForTab(tab))} />
          <AccessDenied />
        </div>
      );
    }
    return (
      <ProtectedRoute>
        <AdminShell />
      </ProtectedRoute>
    );
  }

  if (path === "/staff/queue") {
    // Issue 6: restricted to IT Staff and Administrators (Requesters get 403).
    if (!canAccessStaffQueue(user.role)) {
      return (
        <div className="min-vh-100 d-flex flex-column bg-light">
          <Header activeTab="my-tickets" setActiveTab={(tab) => navigate(pathForTab(tab))} />
          <AccessDenied />
        </div>
      );
    }
    return (
      <ProtectedRoute>
        <StaffShell />
      </ProtectedRoute>
    );
  }

  if (path.startsWith("/staff/tickets/")) {
    if (!canAccessStaffQueue(user.role)) {
      return (
        <div className="min-vh-100 d-flex flex-column bg-light">
          <Header activeTab="my-tickets" setActiveTab={(tab) => navigate(pathForTab(tab))} />
          <AccessDenied />
        </div>
      );
    }
    const ticketId = path.slice("/staff/tickets/".length);
    return (
      <ProtectedRoute>
        <StaffTicketDetailShell ticketId={ticketId} />
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
