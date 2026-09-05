import React, { useState } from "react";
import { useRequesterContext } from "../context/RequesterContext.js";
import { DevSelectorModal } from "./DevSelectorModal.js";

interface HeaderProps {
  activeTab: "my-tickets" | "create-ticket";
  setActiveTab: (tab: "my-tickets" | "create-ticket") => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { currentRequester } = useRequesterContext();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  return (
    <>
      <header
        className="sticky-top shadow-sm"
        style={{
          background: "linear-gradient(135deg, #006B3C 0%, #0B7A46 100%)",
          borderBottom: "3px solid rgba(255,255,255,0.15)",
          zIndex: 1000,
        }}
      >
        <div
          className="d-flex align-items-center justify-content-between flex-wrap gap-2 py-2 px-4"
          style={{ maxWidth: 1100, margin: "0 auto" }}
        >
          {/* Brand */}
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.5rem" }}>🎫</span>
            <div>
              <h1
                className="mb-0 fw-bold text-white"
                style={{ fontSize: "1.15rem", letterSpacing: "-0.5px" }}
              >
                TokTickIT
              </h1>
              <span className="text-white opacity-70" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
                IT SERVICE DESK MVP
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="d-flex gap-1" role="navigation" aria-label="Main navigation">
            <button
              id="nav-tab-my-tickets"
              className={`btn btn-sm px-3 py-2 fw-semibold ${
                activeTab === "my-tickets"
                  ? "bg-white text-zen-primary"
                  : "text-white border-white border-opacity-25"
              }`}
              style={{
                borderRadius: "0.5rem",
                background: activeTab === "my-tickets" ? "#fff" : "rgba(255,255,255,0.12)",
                border: activeTab === "my-tickets" ? "none" : "1px solid rgba(255,255,255,0.25)",
                transition: "all 0.2s ease",
              }}
              onClick={() => setActiveTab("my-tickets")}
            >
              📋 My Tickets
            </button>
            <button
              id="nav-tab-create-ticket"
              className={`btn btn-sm px-3 py-2 fw-semibold`}
              style={{
                borderRadius: "0.5rem",
                background: activeTab === "create-ticket" ? "#fff" : "rgba(255,255,255,0.12)",
                border: activeTab === "create-ticket" ? "none" : "1px solid rgba(255,255,255,0.25)",
                color: activeTab === "create-ticket" ? "#006B3C" : "#fff",
                transition: "all 0.2s ease",
              }}
              onClick={() => setActiveTab("create-ticket")}
            >
              ＋ New Ticket
            </button>
          </nav>

          {/* Dev Identity Button */}
          <button
            id="dev-identity-switcher-btn"
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
            onClick={() => setIsSelectorOpen(true)}
            title="Switch development requester identity"
          >
            <span
              className="d-flex align-items-center justify-content-center rounded-circle fw-bold"
              style={{
                width: 26,
                height: 26,
                background: "rgba(255,255,255,0.25)",
                fontSize: "0.7rem",
              }}
            >
              {currentRequester
                ? currentRequester.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                : "?"}
            </span>
            <span style={{ fontSize: "0.82rem", maxWidth: 120 }} className="text-truncate">
              {currentRequester ? currentRequester.name : "No Identity"}
            </span>
            <span style={{ fontSize: "0.7rem" }}>▾</span>
          </button>
        </div>
      </header>

      <DevSelectorModal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} />
    </>
  );
};
