import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { StaffTicketStatus, TicketPriority, UserRole } from "../../api.js";
import { PriorityBadge } from "../../components/PriorityBadge.js";
import { TicketStatusBadge } from "../../components/TicketStatusBadge.js";
import {
  getStaffDashboard,
  type StaffDashboardData,
  type StaffDashboardRecentTicket,
} from "../../services/staffDashboardApi.js";

export interface StaffDashboardProps {
  /** Full name shown in the welcome banner. */
  userName?: string;
  /** Used to gate the Administrator-only account statistics section. */
  role?: UserRole;
  /** Navigation hook supplied by the app shell (router-aware). */
  onNavigate?: (to: string) => void;
  /** Open a specific ticket from the recent-tickets widget. */
  onViewTicket?: (ticketId: string) => void;
  /** Injectable loader to keep the component easy to test. */
  fetchDashboard?: () => Promise<StaffDashboardData>;
}

interface MetricCard {
  key:
    | "unassignedCount"
    | "assignedToMeCount"
    | "inProgressCount"
    | "waitingRequesterCount"
    | "urgentPriorityCount";
  label: string;
  value: number;
  hint: string;
  to: string;
  tone?: "amber" | "red";
}

interface AdminMetricCard {
  key: string;
  label: string;
  value: number;
  hint: string;
}

const STATUS_KEYS: StaffTicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

const PRIORITY_KEYS: TicketPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * IT Staff & Administrator Dashboard (Lab 4, Issue 7).
 *
 * Zen Green summary cards with drill-down links into the shared queue, quick
 * actions, a recent-ticket widget, and an Administrator-only account summary.
 * All counts are rendered verbatim from the backend response (BR-11).
 */
export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  userName,
  role = "IT_STAFF",
  onNavigate,
  onViewTicket,
  fetchDashboard,
}) => {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      const loader = fetchDashboard ?? getStaffDashboard;
      setData(await loader());
      setLastUpdated(new Date());
    } catch (err) {
      setData(null);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load the staff dashboard. Please try again."
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
        key: "unassignedCount",
        label: "Unassigned Tickets",
        value: data.unassignedCount,
        hint: "Open tickets without an owner",
        to: "/staff/queue?ownerId=unassigned",
        tone: "amber",
      },
      {
        key: "assignedToMeCount",
        label: "Assigned to Me",
        value: data.assignedToMeCount,
        hint: "Active tickets in your workload",
        to: "/staff/queue?ownerId=me",
      },
      {
        key: "inProgressCount",
        label: "In Progress",
        value: data.inProgressCount,
        hint: "Tickets currently being worked on",
        to: "/staff/queue?status=IN_PROGRESS",
      },
      {
        key: "waitingRequesterCount",
        label: "Waiting on Requester",
        value: data.waitingRequesterCount,
        hint: "Blocked pending requester input",
        to: "/staff/queue?status=WAITING_FOR_REQUESTER",
        tone: "amber",
      },
      {
        key: "urgentPriorityCount",
        label: "Urgent Priority",
        value: data.urgentPriorityCount,
        hint: "Unresolved urgent tickets",
        to: "/staff/queue?itPriority=URGENT",
        tone: "red",
      },
    ];
  }, [data]);

  const adminMetrics = useMemo<AdminMetricCard[]>(() => {
    if (role !== "ADMINISTRATOR" || !data) return [];
    const stats = data.userAccountStats;
    const summary = data.userSummary;

    if (!stats && !summary) return [];

    return [
      {
        key: "totalUsersCount",
        label: "Total Users",
        value: stats?.totalUsersCount ?? summary?.totalUsersCount ?? 0,
        hint: "All registered accounts",
      },
      {
        key: "activeUsersCount",
        label: "Active Users",
        value: stats?.activeUsersCount ?? 0,
        hint: "Accounts currently enabled",
      },
      {
        key: "inactiveUsersCount",
        label: "Inactive Users",
        value: stats?.inactiveUsersCount ?? 0,
        hint: "Accounts currently disabled",
      },
      {
        key: "requestersCount",
        label: "Requesters",
        value: stats?.byRole.REQUESTER ?? summary?.activeRequestersCount ?? 0,
        hint: stats ? "Requester accounts" : "Active requester accounts",
      },
      {
        key: "staffCount",
        label: "IT Staff",
        value: stats?.byRole.IT_STAFF ?? summary?.activeStaffCount ?? 0,
        hint: stats ? "IT support accounts" : "Active IT support accounts",
      },
      {
        key: "administratorsCount",
        label: "Administrators",
        value: stats?.byRole.ADMINISTRATOR ?? 0,
        hint: "Administrator accounts",
      },
    ];
  }, [data, role]);

  const openTicket = (ticket: StaffDashboardRecentTicket) => {
    if (onViewTicket) {
      onViewTicket(ticket.id);
      return;
    }
    navigateTo(`/staff/tickets/${ticket.id}`);
  };

  const renderLoading = () => (
    <div data-testid="staff-dashboard-loading" className="d-flex flex-column gap-3" aria-busy="true">
      <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-5 g-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <div className="col" key={index}>
            <div className="card-zen border-0 shadow-sm p-4 placeholder-glow" style={{ minHeight: 150 }}>
              <span className="placeholder col-7 d-block mb-3" />
              <span className="placeholder col-4 d-block mb-3" style={{ height: "2.25rem" }} />
              <span className="placeholder col-9 d-block" />
            </div>
          </div>
        ))}
      </div>
      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="card-zen border-0 shadow-sm p-4 placeholder-glow">
            <span className="placeholder col-3 d-block mb-3" />
            <span className="placeholder col-12 d-block mb-2" />
            <span className="placeholder col-10 d-block" />
          </div>
        </div>
        <div className="col-12 col-xl-4">
          <div className="card-zen border-0 shadow-sm p-4 placeholder-glow">
            <span className="placeholder col-6 d-block mb-3" />
            <span className="placeholder col-12 d-block mb-2" />
            <span className="placeholder col-8 d-block" />
          </div>
        </div>
      </div>
      <span className="visually-hidden">Loading the staff dashboard…</span>
    </div>
  );

  const renderError = () => (
    <div data-testid="staff-dashboard-error" className="card-zen border-0 shadow-sm p-5 text-center">
      <div className="fs-1 mb-2" aria-hidden="true">⚠️</div>
      <h2 className="h5 fw-bold text-danger mb-2">Dashboard unavailable</h2>
      <p className="text-secondary mb-4">{error}</p>
      <button
        type="button"
        data-testid="staff-dashboard-retry"
        className="btn btn-zen-primary px-4"
        onClick={() => void loadDashboard()}
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="d-flex flex-column gap-4" data-testid="staff-dashboard">
      {/* Welcome header */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">
            Welcome back{userName ? `, ${userName}` : ""}!
          </h1>
          <p className="text-muted mb-0">Operational overview of the IT service desk queue.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {lastUpdated && (
            <button
              type="button"
              data-testid="staff-dashboard-refresh"
              className="btn btn-light border px-3 fw-semibold text-secondary"
              onClick={() => void loadDashboard()}
              aria-label="Refresh dashboard metrics"
            >
              Last updated:{" "}
              {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} 🔄
            </button>
          )}
          <button
            type="button"
            data-testid="quick-create-ticket"
            className="btn btn-zen-primary px-3 fw-semibold"
            onClick={() => navigateTo("/create-ticket")}
          >
            + Create Ticket
          </button>
        </div>
      </div>

      {isLoading ? (
        renderLoading()
      ) : error ? (
        renderError()
      ) : data ? (
        <>
          {/* KPI metric cards (5 desktop / 2 tablet / 1 mobile) */}
          <section aria-label="Operational metrics">
            <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-5 g-3">
              {metrics.map((metric) => {
                const isAmber = metric.tone === "amber";
                const isRed = metric.tone === "red";
                return (
                  <div className="col" key={metric.key}>
                    <button
                      type="button"
                      data-testid={`metric-card-${metric.key}`}
                      aria-label={`${metric.label}: ${metric.value}. ${metric.hint}. View all.`}
                      className="card-zen border-0 shadow-sm p-4 text-start w-100 h-100"
                      style={{
                        borderRadius: "0.75rem",
                        background: isRed ? "#FEF2F2" : isAmber ? "#FFFBEB" : "#FFFFFF",
                        border: isRed
                          ? "1px solid #FECACA"
                          : isAmber
                            ? "1px solid #FDE68A"
                            : "1px solid #E3EBE6",
                        boxShadow: "0 2px 8px rgba(0, 107, 60, 0.06)",
                        cursor: "pointer",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onClick={() => navigateTo(metric.to)}
                    >
                      <span
                        className="d-block text-uppercase fw-semibold"
                        style={{
                          fontSize: "0.72rem",
                          letterSpacing: "0.06em",
                          color: isRed ? "#B91C1C" : isAmber ? "#B45309" : "#6C757D",
                        }}
                      >
                        {metric.label}
                      </span>
                      <span
                        data-testid={`metric-value-${metric.key}`}
                        className="d-block fw-bold"
                        style={{
                          fontSize: "2.25rem",
                          lineHeight: 1.15,
                          color: isRed ? "#B91C1C" : isAmber ? "#B45309" : "#006B3C",
                        }}
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
                    onClick={() => navigateTo("/staff/queue")}
                  >
                    View all
                  </button>
                </div>

                {data.recentTickets.length === 0 ? (
                  <div data-testid="recent-tickets-empty" className="p-5 text-center">
                    <div className="fs-1 mb-2" aria-hidden="true">📭</div>
                    <p className="fw-semibold text-dark mb-1">The queue is empty</p>
                    <p className="text-muted small mb-0">New tickets will appear here as they arrive.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" data-testid="recent-tickets-list">
                      <thead className="table-light">
                        <tr>
                          <th scope="col" className="ps-4">Ticket</th>
                          <th scope="col">Summary</th>
                          <th scope="col">IT Priority</th>
                          <th scope="col">Status</th>
                          <th scope="col">Last Updated</th>
                          <th scope="col" className="pe-4 text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentTickets.map((ticket) => (
                          <tr key={ticket.id} data-testid={`recent-ticket-${ticket.id}`}>
                            <td className="ps-4 fw-bold font-monospace" style={{ color: "#006B3C", fontSize: "0.82rem" }}>
                              {ticket.ticketNumber}
                            </td>
                            <td>
                              <div className="fw-semibold text-dark">{ticket.summary}</div>
                              <div className="text-muted small">
                                {ticket.category?.name ?? "Uncategorized"}
                                {ticket.assignedTo ? ` • ${ticket.assignedTo.fullName}` : " • Unassigned"}
                              </div>
                            </td>
                            <td><PriorityBadge priority={ticket.itPriority} /></td>
                            <td><TicketStatusBadge status={ticket.currentStatus} /></td>
                            <td className="text-muted small">{formatDateTime(ticket.updatedAt)}</td>
                            <td className="pe-4 text-end">
                              <button
                                type="button"
                                data-testid={`view-ticket-${ticket.id}`}
                                className="btn btn-link btn-sm text-decoration-none fw-semibold p-0"
                                style={{ color: "#006B3C" }}
                                onClick={() => openTicket(ticket)}
                              >
                                Open Detail ›
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="col-12 col-xl-4">
              <div className="card-zen border-0 shadow-sm h-100 p-4" style={{ borderRadius: "0.75rem" }}>
                <h2 className="h6 fw-bold text-dark mb-1">Quick Actions</h2>
                <p className="text-muted small mb-3">Shortcuts to keep the service desk moving.</p>
                <div className="d-flex flex-column gap-2">
                  <button
                    type="button"
                    data-testid="quick-view-queue"
                    className="btn btn-zen-primary w-100 fw-semibold py-2"
                    onClick={() => navigateTo("/staff/queue")}
                  >
                    📋 View Ticket Queue
                  </button>
                  <button
                    type="button"
                    data-testid="quick-search-tickets"
                    className="btn btn-light border w-100 fw-semibold py-2 text-secondary"
                    onClick={() => navigateTo("/staff/queue")}
                  >
                    🔍 Search Tickets
                  </button>
                  <button
                    type="button"
                    data-testid="quick-create-ticket-secondary"
                    className="btn btn-light border w-100 fw-semibold py-2 text-secondary"
                    onClick={() => navigateTo("/create-ticket")}
                  >
                    + Create Ticket
                  </button>
                </div>

                <div className="mt-4 pt-3 border-top">
                  <h3 className="h6 fw-bold text-dark mb-2">Queue Breakdown</h3>
                  <div className="d-flex flex-wrap gap-2 mb-3" data-testid="status-breakdown">
                    {STATUS_KEYS.map((status) => (
                      <span key={status} className="d-inline-flex align-items-center gap-1">
                        <TicketStatusBadge status={status} />
                        <span className="fw-semibold text-dark" style={{ fontSize: "0.78rem" }}>
                          {data.statusBreakdown[status] ?? 0}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="d-flex flex-wrap gap-2" data-testid="priority-breakdown">
                    {PRIORITY_KEYS.map((priority) => (
                      <span key={priority} className="d-inline-flex align-items-center gap-1">
                        <PriorityBadge priority={priority} />
                        <span className="fw-semibold text-dark" style={{ fontSize: "0.78rem" }}>
                          {data.priorityBreakdown[priority] ?? 0}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-top small text-muted d-flex justify-content-between">
                    <span>Resolved today</span>
                    <span className="fw-semibold text-dark">{data.resolvedTodayCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Administrator-only account statistics */}
          {adminMetrics.length > 0 && (
            <section
              data-testid="admin-user-stats"
              aria-label="User account statistics"
              className="card-zen border-0 shadow-sm p-4"
              style={{ borderRadius: "0.75rem", border: "1px solid #D1FAE5" }}
            >
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <div>
                  <h2 className="h6 fw-bold text-dark mb-1">User Account Overview</h2>
                  <p className="text-muted small mb-0">Administrator-only account statistics.</p>
                </div>
                <span
                  className="badge rounded-pill"
                  style={{ background: "#EAF6EF", color: "#006B3C", border: "1px solid #A7F3D0" }}
                >
                  Administrator
                </span>
              </div>
              <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-6 g-3">
                {adminMetrics.map((metric) => (
                  <div className="col" key={metric.key}>
                    <div
                      data-testid={`admin-metric-${metric.key}`}
                      className="h-100 p-3 rounded-3"
                      style={{ background: "#F8FBF9", border: "1px solid #E3EBE6" }}
                    >
                      <span
                        className="d-block text-uppercase fw-semibold text-muted"
                        style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}
                      >
                        {metric.label}
                      </span>
                      <span
                        data-testid={`admin-metric-value-${metric.key}`}
                        className="d-block fw-bold"
                        style={{ fontSize: "1.6rem", lineHeight: 1.2, color: "#006B3C" }}
                      >
                        {metric.value}
                      </span>
                      <span className="d-block text-muted" style={{ fontSize: "0.75rem" }}>
                        {metric.hint}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
};

export default StaffDashboard;
