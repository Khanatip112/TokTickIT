import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.js";
import { Ticket, Category, Pagination, getMyTickets, getCategories } from "../api.js";

interface MyTicketsListProps {
  onViewTicket: (ticketId: string) => void;
  onCreateTicket: () => void;
}

type SortColumn = "ticketNumber" | "createdAt" | "updatedAt";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 8;

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  NEW: { bg: "#EAF6EF", color: "#006B3C", label: "New" },
  OPEN: { bg: "#e0f0ff", color: "#0066cc", label: "Open" },
  IN_PROGRESS: { bg: "#fff3cd", color: "#856404", label: "In Progress" },
  PENDING: { bg: "#f8d7da", color: "#842029", label: "Pending" },
  RESOLVED: { bg: "#d1e7dd", color: "#0a3622", label: "Resolved" },
  CLOSED: { bg: "#e2e3e5", color: "#41464b", label: "Closed" },
};

const getPriorityBadgeStyle = (priority?: string | null) => {
  switch (priority) {
    case "LOW":
      return { bg: "#e6f4ea", color: "#137333" };
    case "MEDIUM":
      return { bg: "#fef7e0", color: "#b06000" };
    case "HIGH":
      return { bg: "#feefe3", color: "#d96b00" };
    case "URGENT":
      return { bg: "#fce8e6", color: "#c5221f" };
    default:
      return { bg: "#f1f3f4", color: "#5f6368" };
  }
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const MyTicketsList: React.FC<MyTicketsListProps> = ({ onViewTicket, onCreateTicket }) => {
  const { user } = useAuth();
  const requesterId = user?.id;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search State (server-side query params)
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedReqPriority, setSelectedReqPriority] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Sorting State
  const [sortColumn, setSortColumn] = useState<SortColumn>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reference data for the category filter
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Debounce the search box so we don't hammer the API on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // Any filter / sort change resets to the first page
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategoryId, selectedReqPriority, selectedStatus, sortColumn, sortOrder]);

  // Switching requester resets page + reloads
  useEffect(() => {
    setCurrentPage(1);
  }, [requesterId]);

  const loadTickets = useCallback(async () => {
    if (!requesterId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMyTickets(requesterId, {
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId || undefined,
        requestedPriority: selectedReqPriority || undefined,
        currentStatus: selectedStatus || undefined,
        sortBy: sortColumn,
        sortOrder,
      });
      setTickets(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error("Failed to load tickets:", err);
      setError(err instanceof Error ? err.message : "Failed to load tickets. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [
    requesterId,
    currentPage,
    debouncedSearch,
    selectedCategoryId,
    selectedReqPriority,
    selectedStatus,
    sortColumn,
    sortOrder,
  ]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const hasActiveFilters =
    debouncedSearch !== "" ||
    selectedCategoryId !== "" ||
    selectedReqPriority !== "" ||
    selectedStatus !== "";

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedCategoryId("");
    setSelectedReqPriority("");
    setSelectedStatus("");
    setSortColumn("createdAt");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("desc");
    }
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <span className="text-muted opacity-40 ms-1">↕</span>;
    return <span className="ms-1 fw-bold text-dark">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  const totalCount = pagination?.totalCount ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  const getPaginationPages = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  if (!user) {
    return (
      <div className="card-zen p-5 text-center shadow-sm">
        <div className="fs-1 mb-3">👤</div>
        <h3 className="h5 text-zen-primary fw-bold">Not signed in</h3>
        <p className="text-muted">Please sign in to view your tickets.</p>
      </div>
    );
  }

  return (
    <div className="container-fluid px-4 py-3 d-flex flex-column gap-3">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h2 className="h3 fw-bold text-dark mb-1">My Tickets</h2>
          <p className="text-muted small mb-0">View and track all of your support requests.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-light border btn-sm px-3 fw-semibold text-secondary shadow-sm"
            onClick={handleClearFilters}
          >
            ⟳ Clear Filters
          </button>
          <button
            className="btn btn-sm px-3 fw-semibold text-white shadow-sm"
            style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
            onClick={onCreateTicket}
          >
            + Create Ticket
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card border-0 shadow-sm p-3 bg-white" style={{ borderRadius: "0.75rem" }}>
        <div className="row g-2 align-items-center">
          <div className="col-lg-4 col-md-12">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0 text-muted">🔍</span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search by ticket number or summary..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="col-lg-3 col-md-4">
            <select
              className="form-select form-select-sm text-secondary"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-2 col-md-4">
            <select
              className="form-select form-select-sm text-secondary"
              value={selectedReqPriority}
              onChange={(e) => setSelectedReqPriority(e.target.value)}
            >
              <option value="">Requested Priority (All)</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="col-lg-3 col-md-4">
            <select
              className="form-select form-select-sm text-secondary"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Container */}
      <div className="card border-0 shadow-sm bg-white overflow-hidden" style={{ borderRadius: "0.75rem" }}>
        {isLoading ? (
          <div className="py-5 text-center">
            <div className="spinner-border text-zen-primary mb-3" role="status">
              <span className="visually-hidden">Loading tickets...</span>
            </div>
            <p className="text-muted small">Loading support tickets...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <div className="alert alert-danger mb-3">{error}</div>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadTickets}>
              Try Again
            </button>
          </div>
        ) : totalCount === 0 && !hasActiveFilters ? (
          /* 1. True Empty State: this requester has no tickets at all */
          <div className="py-5 text-center">
            <div className="fs-1 mb-2">📭</div>
            <h6 className="fw-bold text-dark mb-1">No tickets yet</h6>
            <p className="text-muted small mb-3">
              You haven't submitted any support tickets. Need help with an IT issue?
            </p>
            <button
              className="btn btn-sm px-3 fw-semibold text-white shadow-sm"
              style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
              onClick={onCreateTicket}
            >
              + Create Ticket
            </button>
          </div>
        ) : tickets.length === 0 ? (
          /* 2. Filtered No Results State */
          <div className="py-5 text-center">
            <div className="fs-1 mb-2">🎫</div>
            <h6 className="fw-bold text-dark mb-1">No matching tickets found</h6>
            <p className="text-muted small mb-3">Try clearing filters or search term to see more results.</p>
            <button className="btn btn-sm btn-outline-secondary" onClick={handleClearFilters}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table (>= md) */}
            <div className="table-responsive d-none d-md-block">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.82rem" }}>
                <thead style={{ backgroundColor: "#F5F7F6" }}>
                  <tr className="text-uppercase text-muted fw-bold" style={{ fontSize: "0.72rem" }}>
                    <th
                      className="py-3 ps-3 text-nowrap cursor-pointer user-select-none"
                      style={{ color: "#006B3C", minWidth: "120px" }}
                      onClick={() => handleSort("ticketNumber")}
                    >
                      Ticket No. {renderSortIcon("ticketNumber")}
                    </th>
                    <th
                      className="py-3 text-nowrap cursor-pointer user-select-none"
                      style={{ minWidth: "130px" }}
                      onClick={() => handleSort("createdAt")}
                    >
                      Created Date {renderSortIcon("createdAt")}
                    </th>
                    <th className="py-3" style={{ minWidth: "200px" }}>
                      Summary
                    </th>
                    <th className="py-3 text-nowrap" style={{ minWidth: "120px" }}>
                      Category
                    </th>
                    <th className="py-3 text-center text-nowrap" style={{ minWidth: "120px" }}>
                      Requested Priority
                    </th>
                    <th className="py-3 text-center text-nowrap" style={{ minWidth: "100px" }}>
                      IT Priority
                    </th>
                    <th className="py-3 text-center text-nowrap" style={{ minWidth: "110px" }}>
                      Current Status
                    </th>
                    <th className="py-3 text-nowrap" style={{ minWidth: "120px" }}>
                      Ticket Owner
                    </th>
                    <th
                      className="py-3 pe-3 text-nowrap cursor-pointer user-select-none"
                      style={{ minWidth: "130px" }}
                      onClick={() => handleSort("updatedAt")}
                    >
                      Last Updated {renderSortIcon("updatedAt")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const statusInfo = STATUS_BADGE[t.currentStatus] || STATUS_BADGE.NEW;
                    const reqPriorityStyle = getPriorityBadgeStyle(t.requestedPriority);
                    const itPriorityStyle = getPriorityBadgeStyle(t.itPriority);

                    return (
                      <tr key={t.id} onClick={() => onViewTicket(t.id)} style={{ cursor: "pointer" }}>
                        <td className="ps-3 fw-bold font-monospace text-nowrap" style={{ color: "#006B3C" }}>
                          {t.ticketNumber}
                        </td>
                        <td className="text-secondary text-nowrap">{formatDate(t.createdAt)}</td>
                        <td className="fw-semibold text-dark text-truncate" style={{ maxWidth: "260px" }}>
                          {t.summary}
                        </td>
                        <td className="text-secondary text-nowrap">{t.category?.name || "N/A"}</td>
                        <td className="text-center text-nowrap">
                          <span
                            className="badge rounded-pill px-2 py-1"
                            style={{ backgroundColor: reqPriorityStyle.bg, color: reqPriorityStyle.color, fontSize: "0.72rem" }}
                          >
                            {t.requestedPriority}
                          </span>
                        </td>
                        <td className="text-center text-nowrap">
                          <span
                            className="badge rounded-pill px-2 py-1"
                            style={{ backgroundColor: itPriorityStyle.bg, color: itPriorityStyle.color, fontSize: "0.72rem" }}
                          >
                            {t.itPriority || "—"}
                          </span>
                        </td>
                        <td className="text-center text-nowrap">
                          <span
                            className="badge rounded-pill px-2 py-1 border"
                            style={{ backgroundColor: statusInfo.bg, color: statusInfo.color, borderColor: statusInfo.color, fontSize: "0.72rem" }}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="text-secondary text-nowrap">{t.requester?.name || user.name}</td>
                        <td className="pe-3 text-secondary text-nowrap">{formatDate(t.updatedAt || t.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< md) */}
            <div className="d-md-none p-3 d-flex flex-column gap-3">
              {tickets.map((t) => {
                const statusInfo = STATUS_BADGE[t.currentStatus] || STATUS_BADGE.NEW;
                const priorityStyle = getPriorityBadgeStyle(t.requestedPriority);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="card border p-3 text-start shadow-sm"
                    style={{ borderRadius: "0.625rem", background: "#fff" }}
                    onClick={() => onViewTicket(t.id)}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
                      <span className="fw-bold font-monospace" style={{ color: "#006B3C" }}>
                        {t.ticketNumber}
                      </span>
                      <span
                        className="badge rounded-pill px-2 py-1 border"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.color, borderColor: statusInfo.color, fontSize: "0.72rem" }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="fw-semibold text-dark mb-2">{t.summary}</div>
                    <div className="d-flex align-items-center flex-wrap gap-2 small text-muted">
                      <span>{t.category?.name || "N/A"}</span>
                      <span>•</span>
                      <span
                        className="badge rounded-pill px-2 py-1"
                        style={{ backgroundColor: priorityStyle.bg, color: priorityStyle.color, fontSize: "0.7rem" }}
                      >
                        {t.requestedPriority}
                      </span>
                      <span>•</span>
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 border-top px-3 py-3">
              <small className="text-muted">
                Showing {startIndex}-{endIndex} of {totalCount} tickets
              </small>
              <nav aria-label="Ticket pagination">
                <ul className="pagination pagination-sm mb-0 gap-1">
                  <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                    <button
                      className="btn btn-sm btn-light border text-secondary px-2"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      ‹ Previous
                    </button>
                  </li>

                  {getPaginationPages().map((page, index) => (
                    <li key={index} className="page-item">
                      {typeof page === "number" ? (
                        <button
                          className={`btn btn-sm fw-semibold px-3 ${currentPage === page ? "text-white" : "btn-light border text-secondary"}`}
                          style={{
                            backgroundColor: currentPage === page ? "#006B3C" : undefined,
                            borderColor: currentPage === page ? "#006B3C" : undefined,
                          }}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ) : (
                        <span className="px-2 text-muted">...</span>
                      )}
                    </li>
                  ))}

                  <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                    <button
                      className="btn btn-sm btn-light border text-secondary px-2"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next ›
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
