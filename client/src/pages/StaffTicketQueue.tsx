import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Category,
  Pagination,
  StaffTicket,
  StaffUser,
  getCategories,
  getStaffTickets,
  getStaffUsers,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { TicketStatusBadge, TICKET_STATUS_OPTIONS } from "../components/TicketStatusBadge.js";
import { PriorityBadge, PRIORITY_OPTIONS } from "../components/PriorityBadge.js";

type SortColumn = "ticketNumber" | "createdAt" | "updatedAt" | "itPriority";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 10;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

interface StaffTicketQueueProps {
  /** Navigates to the IT Staff ticket detail page (Issue 7). */
  onViewTicket: (ticketId: string) => void;
}

/**
 * Screen 3 — IT Staff Ticket Queue (`/staff/queue`), ui-spec.md §4.4.
 * Desktop renders a full data table (>= 768px); mobile renders a card list
 * (< 768px) with no horizontal scroll. Includes loading skeletons, empty /
 * no-results states, error banners, and pagination controls.
 */
export const StaffTicketQueue: React.FC<StaffTicketQueueProps> = ({ onViewTicket }) => {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<StaffTicket[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state (server-side query params)
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedItPriority, setSelectedItPriority] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");

  // Sorting + pagination
  const [sortColumn, setSortColumn] = useState<SortColumn>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    getStaffUsers()
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  // Debounce the search box so the API is not hammered on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // Any filter / sort change resets to the first page.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategoryId, selectedStatus, selectedItPriority, selectedOwner, sortColumn, sortOrder]);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getStaffTickets({
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId || undefined,
        status: selectedStatus || undefined,
        itPriority: selectedItPriority || undefined,
        ownerId: selectedOwner || undefined,
        sortBy: sortColumn,
        sortOrder,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      setTickets(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the ticket queue.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedSearch,
    selectedCategoryId,
    selectedStatus,
    selectedItPriority,
    selectedOwner,
    sortColumn,
    sortOrder,
    currentPage,
  ]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const hasActiveFilters =
    debouncedSearch !== "" ||
    selectedCategoryId !== "" ||
    selectedStatus !== "" ||
    selectedItPriority !== "" ||
    selectedOwner !== "";

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedCategoryId("");
    setSelectedStatus("");
    setSelectedItPriority("");
    setSelectedOwner("");
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

  const totalCount = pagination?.totalCount ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  const pageNumbers = useMemo<(number | string)[]>(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
    } else if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return <span className="text-muted opacity-50 ms-1">↕</span>;
    return <span className="ms-1 fw-bold">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  const ownerLabel = (ticket: StaffTicket) =>
    ticket.owner ? ticket.owner.name : <span className="text-muted fst-italic">Unassigned</span>;

  const showNoResults = !isLoading && !error && tickets.length === 0 && hasActiveFilters;
  const showEmpty = !isLoading && !error && tickets.length === 0 && !hasActiveFilters;

  return (
    <div className="d-flex flex-column gap-3">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h2 className="h3 fw-bold text-dark mb-1">My Queue</h2>
          <p className="text-muted small mb-0">Triage, assign, and progress tickets across the service desk.</p>
        </div>
      </div>

      {/* Search + filter toolbar */}
      <div className="card-zen p-3 d-flex flex-column gap-2">
        <input
          id="queue-search"
          type="search"
          className="form-control"
          placeholder="Search by ticket number or summary..."
          aria-label="Search by ticket number or summary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="d-flex flex-wrap gap-2 align-items-center">
          <select
            id="filter-category"
            className="form-select"
            style={{ width: 170 }}
            aria-label="Filter by category"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            id="filter-status"
            className="form-select"
            style={{ width: 170 }}
            aria-label="Filter by status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {TICKET_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            id="filter-it-priority"
            className="form-select"
            style={{ width: 160 }}
            aria-label="Filter by IT priority"
            value={selectedItPriority}
            onChange={(e) => setSelectedItPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            id="filter-owner"
            className="form-select"
            style={{ width: 190 }}
            aria-label="Filter by owner"
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
          >
            <option value="">All Owners</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-zen-outline ms-auto"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-0" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span className="small fw-semibold">{error}</span>
        </div>
      )}

      {!isLoading && !error && (
        <div className="text-muted small" data-testid="results-counter">
          Showing {startIndex} to {endIndex} of {totalCount} tickets
        </div>
      )}

      {isLoading ? (
        <>
          {/* Desktop loading skeleton */}
          <div className="card-zen overflow-hidden d-none d-md-block" data-testid="queue-skeleton">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="py-3">
                        <span className="zen-skeleton zen-skeleton-line" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Mobile loading skeleton */}
          <div className="d-md-none d-flex flex-column gap-2" data-testid="queue-skeleton-mobile">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-zen p-3">
                <span className="zen-skeleton zen-skeleton-line mb-2" />
                <span className="zen-skeleton zen-skeleton-line" style={{ width: "60%" }} />
              </div>
            ))}
          </div>
        </>
      ) : showEmpty || showNoResults ? (
        <div className="card-zen p-5 text-center" data-testid="queue-empty">
          <div className="fs-1 mb-2" aria-hidden="true">🗂️</div>
          <h3 className="h5 fw-bold text-zen-primary">
            {showNoResults ? "No tickets match your search filters" : "No tickets in queue"}
          </h3>
          <p className="text-muted small mb-3">
            {showNoResults
              ? "Try adjusting or clearing your filters."
              : "New requester tickets will appear here as they are submitted."}
          </p>
          {hasActiveFilters && (
            <button type="button" className="btn btn-zen-outline" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table (>= 768px) */}
          <div className="card-zen overflow-hidden d-none d-md-block" data-testid="queue-table">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr className="text-muted text-uppercase small">
                    <th scope="col" className="ps-3 sortable" onClick={() => handleSort("ticketNumber")}>
                      Ticket No {sortIndicator("ticketNumber")}
                    </th>
                    <th scope="col" className="sortable" onClick={() => handleSort("createdAt")}>
                      Created {sortIndicator("createdAt")}
                    </th>
                    <th scope="col">Summary</th>
                    <th scope="col">Category</th>
                    <th scope="col">Req. Priority</th>
                    <th scope="col" className="sortable" onClick={() => handleSort("itPriority")}>
                      IT Priority {sortIndicator("itPriority")}
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col" className="pe-3">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      data-testid="queue-row"
                      className="cursor-pointer"
                      onClick={() => onViewTicket(ticket.id)}
                    >
                      <td className="ps-3">
                        <button
                          type="button"
                          className="btn btn-link p-0 fw-semibold text-decoration-none queue-ticket-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewTicket(ticket.id);
                          }}
                        >
                          {ticket.ticketNumber}
                        </button>
                      </td>
                      <td className="text-secondary text-nowrap small">{formatDateTime(ticket.createdAt)}</td>
                      <td className="queue-summary" title={ticket.summary}>{ticket.summary}</td>
                      <td className="text-secondary small">{ticket.category.name}</td>
                      <td><PriorityBadge priority={ticket.requestedPriority} /></td>
                      <td><PriorityBadge priority={ticket.itPriority} /></td>
                      <td><TicketStatusBadge status={ticket.currentStatus} /></td>
                      <td className="pe-3 small">{ownerLabel(ticket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list (< 768px) */}
          <div className="d-md-none d-flex flex-column gap-2" data-testid="queue-cards">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                data-testid="queue-card"
                className="card-zen p-3 text-start w-100 border queue-card"
                onClick={() => onViewTicket(ticket.id)}
              >
                <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                  <span className="fw-bold text-zen-primary">{ticket.ticketNumber}</span>
                  <TicketStatusBadge status={ticket.currentStatus} />
                </div>
                <div className="fw-semibold text-dark mb-2">{ticket.summary}</div>
                <div className="small text-muted d-flex flex-wrap align-items-center gap-2 mb-1">
                  <span>Category: {ticket.category.name}</span>
                  <span aria-hidden="true">•</span>
                  <span className="d-inline-flex align-items-center gap-1">
                    IT Priority: <PriorityBadge priority={ticket.itPriority} />
                  </span>
                </div>
                <div className="small text-muted mb-1">
                  Requester: {ticket.requester.name} • Owner: {ticket.owner ? ticket.owner.name : "Unassigned"}
                </div>
                <div className="small text-muted mb-2">Created: {formatDateTime(ticket.createdAt)}</div>
                <div className="text-end fw-semibold text-zen-primary small">View Detail ›</div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className="d-flex align-items-center justify-content-center flex-wrap gap-1"
              aria-label="Queue pagination"
            >
              <button
                type="button"
                className="btn btn-sm btn-light border"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              >
                ‹ Previous
              </button>
              {pageNumbers.map((page, index) =>
                typeof page === "number" ? (
                  <button
                    key={index}
                    type="button"
                    data-testid={`page-${page}`}
                    className={`btn btn-sm fw-semibold px-3 ${currentPage === page ? "text-white" : "btn-light border text-secondary"}`}
                    style={
                      currentPage === page
                        ? { backgroundColor: "#006B3C", borderColor: "#006B3C" }
                        : undefined
                    }
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={index} className="px-2 text-muted">
                    …
                  </span>
                )
              )}
              <button
                type="button"
                className="btn btn-sm btn-light border"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              >
                Next ›
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
};