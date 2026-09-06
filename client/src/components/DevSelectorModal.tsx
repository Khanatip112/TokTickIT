import React from "react";
import { DevRequester } from "../api.js";
import { useRequesterContext } from "../context/RequesterContext.js";

interface DevSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevSelectorModal: React.FC<DevSelectorModalProps> = ({ isOpen, onClose }) => {
  const { currentRequester, allRequesters, setCurrentRequester } = useRequesterContext();

  if (!isOpen) return null;

  function handleSelect(requester: DevRequester) {
    setCurrentRequester(requester);
    onClose();
  }

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 2000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="devSelectorModalTitle"
    >
      <div className="modal-dialog modal-dialog-centered px-2" style={{ maxWidth: 480 }}>
        <div className="modal-content shadow-lg border-0 overflow-hidden" style={{ borderRadius: "0.875rem" }}>
          <div
            className="modal-header text-white"
            style={{ background: "linear-gradient(135deg, #006B3C 0%, #0B7A46 100%)", borderRadius: "0.875rem 0.875rem 0 0" }}
          >
            <div>
              <h5 id="devSelectorModalTitle" className="modal-title fw-bold mb-0">
                🔧 Development Identity Context
              </h5>
              <small className="opacity-75">Select active requester for this session</small>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
            />
          </div>

          <div className="modal-body p-3 p-sm-4">
            <div
              className="alert mb-3 py-2 px-3 small border-0 text-break"
              style={{ backgroundColor: "#EAF6EF", color: "#006B3C", borderLeft: "4px solid #006B3C" }}
            >
              <strong>⚠️ Dev-only feature:</strong> No real authentication is used. Switching identity
              changes the localStorage key <code>toktickit_requester_id</code>.
            </div>

            {allRequesters.length === 0 ? (
              <p className="text-muted text-center py-3">No active requesters found.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {allRequesters.map((requester) => {
                  const isActive = currentRequester?.id === requester.id;
                  return (
                    <button
                      key={requester.id}
                      id={`dev-requester-${requester.id}`}
                      className={`btn text-start p-3 w-100 border ${isActive ? "btn-zen-primary" : "btn-outline-secondary"
                        }`}
                      style={{ borderRadius: "0.625rem", transition: "all 0.15s ease" }}
                      onClick={() => handleSelect(requester)}
                    >
                      <div className="d-flex align-items-center gap-2 gap-sm-3 w-100 min-w-0">
                        {/* Avatar Circle */}
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                          style={{
                            width: 38,
                            height: 38,
                            background: isActive ? "rgba(255,255,255,0.25)" : "#006B3C",
                            fontSize: "0.82rem",
                          }}
                        >
                          {requester.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>

                        {/* Text Container - มี min-w-0 และ text-break ป้องกันข้อความล้น */}
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-semibold text-truncate">{requester.name}</div>
                          <small
                            className={`d-block text-break ${isActive ? "opacity-75" : "text-muted"}`}
                            style={{ fontSize: "0.75rem", lineHeight: "1.2" }}
                          >
                            {requester.email} {requester.department ? `· ${requester.department}` : ""}
                          </small>
                        </div>

                        {/* Active Badge - ล็อค flex-shrink-0 อยู่ภายในขอบขวาสวยงาม */}
                        {isActive && (
                          <span className="badge bg-white text-success flex-shrink-0 ms-1 ms-sm-2 shadow-sm">
                            Active
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer border-top-0 px-3 px-sm-4 pb-3 pb-sm-4">
            <button className="btn btn-outline-secondary w-100" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};