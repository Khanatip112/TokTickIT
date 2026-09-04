import React from "react";
import { useRequesterContext } from "../context/RequesterContext.js";

export const DevSelectorModal: React.FC = () => {
  const {
    currentRequester,
    activeRequesters,
    isSelectorOpen,
    closeSelector,
    setRequester,
    isLoading,
    error,
  } = useRequesterContext();

  if (!isSelectorOpen) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: "0.75rem" }}>
          {/* Modal Header */}
          <div
            className="modal-header text-white"
            style={{ backgroundColor: "var(--zen-primary)", borderTopLeftRadius: "0.75rem", borderTopRightRadius: "0.75rem" }}
          >
            <div className="d-flex align-items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
              </svg>
              <h5 className="modal-title fw-bold mb-0">Select Development Requester</h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={closeSelector}
              aria-label="Close"
            ></button>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4" style={{ backgroundColor: "var(--zen-bg)" }}>
            {/* Informational Callout */}
            <div className="alert alert-info border-0 shadow-sm mb-4 d-flex align-items-start gap-3" style={{ backgroundColor: "var(--zen-pale-surface)", color: "var(--zen-text)" }}>
              <span className="fs-4">ℹ️</span>
              <div>
                <strong className="d-block text-zen-primary">Testing Context Simulator (Lab 2)</strong>
                <small className="text-secondary">
                  Select a Development Requester to test requester-specific ticket creation, isolation, and attachments.
                  Authentication and password security will be introduced in Lab 3.
                </small>
              </div>
            </div>

            {isLoading && (
              <div className="text-center py-4">
                <div className="spinner-border text-zen-primary" role="status">
                  <span className="visually-hidden">Loading requesters...</span>
                </div>
                <p className="mt-2 text-muted">Loading active requesters...</p>
              </div>
            )}

            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            {!isLoading && !error && (
              <div className="row g-3">
                {activeRequesters.map((req) => {
                  const isSelected = currentRequester?.id === req.id;
                  return (
                    <div className="col-md-6" key={req.id}>
                      <div
                        className={`card h-100 p-3 cursor-pointer transition-all ${
                          isSelected
                            ? "border-2 border-zen-primary bg-zen-pale shadow-sm"
                            : "border-1 border-secondary-subtle bg-white"
                        }`}
                        style={{ cursor: "pointer", borderRadius: "0.5rem" }}
                        onClick={() => {
                          setRequester(req.id);
                          closeSelector();
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center gap-3">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                              style={{
                                width: "42px",
                                height: "42px",
                                backgroundColor: isSelected ? "var(--zen-primary)" : "var(--zen-text-muted)",
                              }}
                            >
                              {req.name.charAt(0)}
                            </div>
                            <div>
                              <h6 className="fw-bold mb-0 text-dark">{req.name}</h6>
                              <small className="text-muted d-block">{req.email}</small>
                              {req.department && (
                                <span className="badge bg-secondary-subtle text-secondary mt-1">
                                  {req.department}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="badge bg-zen-primary text-white p-2 rounded-circle">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer bg-white border-top-0 rounded-bottom-4 px-4 py-3">
            <button type="button" className="btn btn-secondary px-4" onClick={closeSelector}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
