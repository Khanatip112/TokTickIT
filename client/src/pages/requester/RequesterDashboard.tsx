import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PriorityBadge } from "../../components/PriorityBadge.js";
import { TicketStatusBadge } from "../../components/TicketStatusBadge.js";
import {
  getRequesterDashboard,
  type RequesterDashboardData,
  type RequesterRecentTicket,
} from "../../services/dashboardApi.js";

export interface RequesterDashboardProps {
  /** Full name shown in the welcome banner. */
  userName?: string;
  /** Navigation hook supplied by the app shell (router-aware). */
  onNavigate?: (to: string) => void;
  /** Open a specific ticket from the recent-tickets widget. */
  onViewTicket?: (ticketId: string) => void;
  /** Injectable loader to keep the component easy to test. */
  fetchDashboard?: () => Promise<RequesterDashboardData>;
}

interface MetricCard {
  key: "totalOpenTickets" | "inProgressCount" | "waitingForRequesterCount" | "recentlyResolvedCount";
  label: string;
  value: number;
  hint: string;
  to: string;
  tone?: "amber";
}

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Requester Dashboard (Lab 4, Issue 6).
 *
 * Zen Green summary cards with drill-down links, quick actions, and a recent
 * tickets widget. All counts are rendered verbatim from the backend response;
 * no authoritative metric is computed on the client (BR-11).
 */
export const RequesterDashboard: React.FC<RequesterDashboardProps> = ({
  userName,
  onNavigate,
  onViewTicket,
  fetchDashboard,
}) => {
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const navigateTo = useCallback(
    (to: string) => {
      if (onNavigate) {
        onNavigate(to);
        return;
      }
      if (typeof window !== "undefined") window.location.assign(to);
    },
    [onNavigate]
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loader = fetchDashboard ?? getRequesterDashboard;
      setData(await loader());
    } catch (err) {
      setData(null);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load your dashboard. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboard]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo<MetricCard[]>(() => {
    if (!data) return [];
    return [
      {
        key: "totalOpenTickets",
        label: "My Open Tickets",
        value: data.totalOpenTickets,
        hint: "Active requests in the queue",
        to: "/my-tickets",
      },
      {
        key: "inProgressCount",
        label: "In Progress",
        value: data.inProgressCount,
        hint: "Currently being worked on",
        to: "/my-tickets?status=IN_PROGRESS",
      },
      {
        key: "waitingForRequesterCount",
        label: "Waiting for My Reply",
        value: data.waitingForRequesterCount,
        hint: "IT is waiting on information from you",
        to: "/my-tickets?status=WAITING_FOR_REQUESTER",
        tone: "amber",
      },
      {
        key: "recentlyResolvedCount",
        label: "Resolved",
        value: data.recentlyResolvedCount,
        hint: "Resolved and awaiting closure",
        to: "/my-tickets?status=RESOLVED",
      },
    ];
  }, [data]);

  const openTicket = (ticket: RequesterRecentTicket) => {
    if (onViewTicket) {
      onViewTicket(ticket.id);
      return;
    }
    navigateTo(`/requester/tickets/${ticket.id}`);
  };

  const renderLoading = () => (
    <div data-testid="requester-dashboard-loading" className="d-flex flex-column gap-3" aria-busy="true">
      <div className="row g-3">
        {[0, 1, 2, 3].map((index) => (
          <div className="col-12 col-sm-6 col-xl-3" key={index}>
            <div className="card-zen border-0 shadow-sm p-4 placeholder-glow" style={{ minHeight: 150 }}>
              <span className="placeholder col-7 d-block mb-3" />
              <span className="placeholder col-4 d-block mb-3" style={{ height: "2.25rem" }} />
              <span className="placeholder col-9 d-block" />
            </div>
          </div>
        ))}
      </div>
      <div className="card-zen border-0 shadow-sm p-4 placeholder-glow">
        <span className="placeholder col-3 d-block mb-3" />
        <span className="placeholder col-12 d-block mb-2" />
        <span className="placeholder col-10 d-block" />
      </div>
      <span className="visually-hidden">Loading your dashboard…</span>
    </div>
  );

  const renderError = () => (
    <div data-testid="requester-dashboard-error" className="card-zen border-0 shadow-sm p-5 text-center">
      <div className="fs-1 mb-2" aria-hidden="true">⚠️</div>
      <h2 className="h5 fw-bold text-danger mb-2">Dashboard unavailable</h2>
      <p className="text-secondary mb-4">{error}</p>
      <button
        type="button"
        data-testid="requester-dashboard-retry"
        className="btn btn-zen-primary px-4"
        onClick={() => void loadDashboard()}
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="d-flex flex-column gap-4" data-testid="requester-dashboard">
      {/* Welcome header */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">
            Welcome{userName ? `, ${userName}` : ""}!
          </h1>
          <p className="text-muted mb-0">
            Here's the current status of your submitted support tickets.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="quick-create-ticket"
            className="btn btn-zen-primary px-3 fw-semibold"
            onClick={() => navigateTo("/create-ticket")}
          >
            + Create Ticket
          </button>
          <button
            type="button"
            data-testid="quick-view-all-tickets"
            className="btn btn-light border px-3 fw-semibold text-secondary"
            onClick={() => navigateTo("/my-tickets")}
          >
            View All My Tickets
          </button>
        </div>
      </div>

      {isLoading ? (
        renderLoading()
      ) : error ? (
        renderError()
      ) : data ? (
        <>
          {/* KPI metric cards (4 columns desktop / 2 tablet / 1 mobile) */}
          <section aria-label="Ticket summary metrics">
            <div className="row g-3">
              {metrics.map((metric) => {
                const isAmber = metric.tone === "amber";
                return (
                  <div className="col-12 col-sm-6 col-xl-3" key={metric.key}>
                    <button
                      type="button"
                      data-testid={`metric-card-${metric.key}`}
                      aria-label={`${metric.label}: ${metric.value}. ${metric.hint}. View all.`}
                      className="card-zen border-0 shadow-sm p-4 text-start w-100 h-100"
                      style={{
                        borderRadius: "0.75rem",
                        background: isAmber ? "#FFFBEB" : "#FFFFFF",
                        border: isAmber ? "1px solid #FDE68A" : "1px solid #E3EBE6",
                        boxShadow: "0 2px 8px rgba(0, 107, 60, 0.06)",
                        cursor: "pointer",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onClick={() => navigateTo(metric.to)}
                    >
                      <span
                        className="d-block text-uppercase fw-semibold"
                        style={{ fontSize: "0.75rem", letterSpacing: "0.06em", color: isAmber ? "#B45309" : "#6C757D" }}
                      >
                        {metric.label}
                      </span>
                      <span
                        data-testid={`metric-value-${metric.key}`}
                        className="d-block fw-bold"
                        style={{ fontSize: "2.25rem", lineHeight: 1.15, color: isAmber ? "#B45309" : "#006B3C" }}
                      >
                        {metric.value}
                      </span>
                      <span className="d-block text-muted mb-2" style={{ fontSize: "0.8125rem" }}>
                        {metric.hint}
                      </span>
                      <span className="fw-semibold" style={{ fontSize: "0.8125rem", color: "#006B3C" }}>
                        View all ›
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent tickets + quick actions split */}
          <section className="row g-4" aria-label="Recent tickets and quick actions">
            <div className="col-12 col-xl-8">
              <div className="card-zen border-0 shadow-sm h-100 p-0 overflow-hidden" style={{ borderRadius: "0.75rem" }}>
                <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
                  <h2 className="h6 fw-bold text-dark mb-0">Recent Tickets</h2>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none fw-semibold p-0"
                    style={{ color: "#006B3C" }}
                    onClick={() => navigateTo("/my-tickets")}
                  >
                    View all
                  </button>
                </div>

                {data.recentTickets.length === 0 ? (
                  <div data-testid="recent-tickets-empty" className="p-5 text-center">
                    <div className="fs-1 mb-2" aria-hidden="true">📭</div>
                    <p className="fw-semibold text-dark mb-1">No tickets yet</p>
                    <p className="text-muted small mb-3">
                      Submit your first support request and it will appear here.
                    </p>
                    <button
                      type="button"
                      className="btn btn-zen-primary btn-sm px-3"
                      onClick={() => navigateTo("/create-ticket")}
                    >
                      + Create Ticket
                    </button>
                  </div>
                ) : (
                  <ul className="list-unstyled mb-0" data-testid="recent-tickets-list">
                    {data.recentTickets.map((ticket) => (
                      <li
                        key={ticket.id}
                        data-testid={`recent-ticket-${ticket.id}`}
                        className="px-4 py-3 border-bottom"
                      >
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                          <div className="d-flex align-items-center flex-wrap gap-2">
                            <span className="fw-bold font-monospace" style={{ color: "#006B3C", fontSize: "0.82rem" }}>
                              {ticket.ticketNumber}
                            </span>
                            <TicketStatusBadge status={ticket.currentStatus} />
                            <PriorityBadge priority={ticket.requestedPriority} />
                          </div>
                          <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {formatDateTime(ticket.updatedAt)}
                          </span>
                        </div>
                        <div className="fw-semibold text-dark mb-1">{ticket.summary}</div>
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <span className="text-muted small">
                            {ticket.category?.name ?? "Uncategorized"}
                            {ticket.assignedTo ? ` • Owner: ${ticket.assignedTo.fullName}` : " • Unassigned"}
                          </span>
                          <button
                            type="button"
                            data-testid={`view-ticket-${ticket.id}`}
                            className="btn btn-link btn-sm text-decoration-none fw-semibold p-0"
                            style={{ color: "#006B3C" }}
                            onClick={() => openTicket(ticket)}
                          >
                            View Ticket ›
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="col-12 col-xl-4">
              <div className="card-zen border-0 shadow-sm h-100 p-4" style={{ borderRadius: "0.75rem" }}>
                <h2 className="h6 fw-bold text-dark mb-1">Quick Actions</h2>
                <p className="text-muted small mb-3">Shortcuts to manage your support requests.</p>
                <div className="d-flex flex-column gap-2">
                  <button
                    type="button"
                    className="btn btn-zen-primary w-100 fw-semibold py-2"
                    onClick={() => navigateTo("/create-ticket")}
                  >
                    + Submit New Ticket
                  </button>
                  <button
                    type="button"
                    className="btn btn-light border w-100 fw-semibold py-2 text-secondary"
                    onClick={() => navigateTo("/my-tickets")}
                  >
                    📋 View All My Tickets
                  </button>
                  <button
                    type="button"
                    className="btn btn-light border w-100 fw-semibold py-2 text-secondary"
                    onClick={() => navigateTo("/my-tickets?status=WAITING_FOR_REQUESTER")}
                  >
                    ⏳ Review Waiting Tickets
                  </button>
                </div>
                <div className="mt-4 pt-3 border-top small text-muted">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Closed tickets</span>
                    <span className="fw-semibold text-dark">{data.closedTicketsCount}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Updated in last 7 days</span>
                    <span className="fw-semibold text-dark">{data.recentlyUpdatedCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default RequesterDashboard;
