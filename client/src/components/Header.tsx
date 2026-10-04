import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { useRouter } from "../router.js";
import { RoleBadge } from "./RoleBadge.js";

export type HeaderTab = "my-tickets" | "create-ticket" | "admin";

interface HeaderProps {
  activeTab: HeaderTab;
  setActiveTab: (tab: HeaderTab) => void;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Application shell header (ui-spec.md §4.3).
 * Shows the brand, role navigation, and a profile menu with the active user's
 * full name, role badge, "Change Password" and "Sign Out".
 */
export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await logout();
    navigate("/login");
  };

  const handleChangePassword = () => {
    setIsMenuOpen(false);
    navigate("/change-password");
  };

  const navButtonStyle = (isActive: boolean): React.CSSProperties => ({
    borderRadius: "0.5rem",
    background: isActive ? "#fff" : "rgba(255,255,255,0.12)",
    border: isActive ? "none" : "1px solid rgba(255,255,255,0.25)",
    color: isActive ? "#006B3C" : "#fff",
    transition: "all 0.2s ease",
  });

  // Role-aware navigation (ui-spec.md §4.3): Administrators get an "Admin" tab.
  const navTabs: { key: HeaderTab; label: string }[] = [
    ...(user?.role === "ADMINISTRATOR" ? [{ key: "admin" as HeaderTab, label: "Admin" }] : []),
    { key: "my-tickets", label: "My Tickets" },
    { key: "create-ticket", label: "＋ Create Ticket" },
  ];

  return (
    <header
      className="sticky-top shadow-sm"
      style={{
        background: "linear-gradient(135deg, #006B3C 0%, #0B7A46 100%)",
        borderBottom: "3px solid rgba(255,255,255,0.15)",
        zIndex: 1000,
      }}
    >
      <div className="container-fluid px-4 d-flex align-items-center justify-content-between flex-wrap gap-2 py-2">
        {/* Brand */}
        <div className="d-flex align-items-center gap-2">
          <div>
            <h1 className="mb-0 fw-bold text-white" style={{ fontSize: "1.15rem", letterSpacing: "-0.5px" }}>
              TokTickIT
            </h1>
            <span className="text-white opacity-70" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
              IT SERVICE DESK
            </span>
          </div>
        </div>

        {/* Navigation tabs (role-aware) */}
        <nav className="d-flex gap-1" role="navigation" aria-label="Main navigation">
          {navTabs.map((tab) => (
            <button
              key={tab.key}
              id={`nav-tab-${tab.key}`}
              type="button"
              className="btn btn-sm px-3 py-2 fw-semibold"
              style={navButtonStyle(activeTab === tab.key)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Profile menu */}
        <div className="position-relative">
          <button
            id="user-menu-btn"
            type="button"
            className="btn btn-sm d-flex align-items-center gap-2"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: "2rem",
              color: "#fff",
              padding: "0.35rem 0.85rem",
              backdropFilter: "blur(4px)",
              transition: "background 0.2s",
            }}
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            title="Account menu"
          >
            <span
              className="d-flex align-items-center justify-content-center rounded-circle fw-bold"
              style={{ width: 26, height: 26, background: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}
            >
              {user ? initialsOf(user.name) : "?"}
            </span>
            <span style={{ fontSize: "0.82rem", maxWidth: 130 }} className="text-truncate">
              {user ? user.name : "Signed out"}
            </span>
            {user && <RoleBadge role={user.role} />}
            <span style={{ fontSize: "0.7rem" }} aria-hidden="true">
              ▾
            </span>
          </button>

          {isMenuOpen && user && (
            <div
              role="menu"
              className="profile-menu card shadow-lg border-0"
              style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 260, zIndex: 1100 }}
            >
              <div className="px-3 py-3 border-bottom">
                <div className="fw-semibold text-dark text-truncate">{user.name}</div>
                <div className="text-muted small text-truncate">{user.email}</div>
                <div className="mt-2">
                  <RoleBadge role={user.role} />
                </div>
              </div>
              <button
                type="button"
                role="menuitem"
                className="btn btn-link text-start text-decoration-none text-dark px-3 py-2 w-100 border-0"
                onClick={handleChangePassword}
              >
                🔑 Change Password
              </button>
              <button
                type="button"
                role="menuitem"
                className="btn btn-link text-start text-decoration-none px-3 py-2 w-100 border-0"
                style={{ color: "#DC2626" }}
                onClick={handleSignOut}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
