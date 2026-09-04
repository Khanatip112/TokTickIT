import React from "react";
import { useRequesterContext } from "../context/RequesterContext.js";

interface HeaderProps {
  activeTab?: "my-tickets" | "create-ticket";
  onNavigate?: (tab: "my-tickets" | "create-ticket") => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab = "my-tickets", onNavigate }) => {
  const { currentRequester, openSelector } = useRequesterContext();

  return (
    <header className="bg-zen-primary text-white shadow-sm sticky-top">
      <div className="container-fluid px-4 py-2">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          {/* Brand Logo & Navigation Links */}
          <div className="d-flex align-items-center gap-4">
            <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => onNavigate && onNavigate("my-tickets")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
              </svg>
              <span className="fs-4 fw-bold tracking-tight">TokTickIT</span>
            </div>

            <nav className="d-flex gap-2">
              <button
                className={`btn btn-sm px-3 ${
                  activeTab === "my-tickets" ? "btn-zen-light shadow-sm" : "text-white text-decoration-none"
                }`}
                onClick={() => onNavigate && onNavigate("my-tickets")}
              >
                📋 My Tickets
              </button>
              <button
                className={`btn btn-sm px-3 ${
                  activeTab === "create-ticket" ? "btn-zen-light shadow-sm" : "text-white text-decoration-none"
                }`}
                onClick={() => onNavigate && onNavigate("create-ticket")}
              >
                ➕ Create Ticket
              </button>
            </nav>
          </div>

          {/* Dev Identity Context Badge */}
          <div className="d-flex align-items-center gap-3">
            {currentRequester ? (
              <div className="d-flex align-items-center bg-white bg-opacity-10 rounded-3 px-3 py-1 border border-white border-opacity-25">
                <div className="me-3 text-end">
                  <div className="fw-semibold text-white lh-1 small">{currentRequester.name}</div>
                  <small className="text-white-50 opacity-75" style={{ fontSize: "0.75rem" }}>
                    {currentRequester.department ? `${currentRequester.department} • ` : ""}
                    {currentRequester.email}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-zen-light d-flex align-items-center gap-1 shadow-sm ms-2"
                  onClick={openSelector}
                  title="Switch active Development Requester identity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5zm14-7a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 5H14.5a.5.5 0 0 0 .5-.5z"/>
                  </svg>
                  <span>Change Requester</span>
                </button>
              </div>
            ) : (
              <button className="btn btn-sm btn-zen-light" onClick={openSelector}>
                Select Requester Identity
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
