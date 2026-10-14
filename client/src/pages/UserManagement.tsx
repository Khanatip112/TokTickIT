import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  UserRole,
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { StatusBadge } from "../components/StatusBadge.js";

const PAGE_SIZE = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "REQUESTER", label: "Requester" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "ADMINISTRATOR", label: "Administrator" },
];

/** Generates a complexity-compliant temporary password for the create/reset forms. */
function generateTempPassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%&*";
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set.charAt(Math.floor(Math.random() * set.length))).join("");
  const chars = (
    pick(upper, 1) +
    pick(lower, 4) +
    pick(digits, 2) +
    pick(special, 1) +
    pick(lower + upper + digits, 4)
  ).split("");
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}

interface UserFormState {
  id: string | null;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  initialPassword: string;
}

const emptyForm = (): UserFormState => ({
  id: null,
  name: "",
  email: "",
  role: "REQUESTER",
  department: "",
  isActive: true,
  initialPassword: generateTempPassword(),
});

/**
 * Screen 5 — Administrator User Management (`/admin/users`) per ui-spec.md §4.6.
 * Directory table with search/role/status filters, client-side pagination,
 * create/edit drawer and administrative password reset.
 */
export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === "ADMINISTRATOR" && u.isActive).length,
    [users]
  );

  const isSelf = useCallback((u: AdminUser) => u.id === currentUser?.id, [currentUser?.id]);

  /** BR-23 safety UI state: the only remaining active Administrator. */
  const isLastActiveAdmin = useCallback(
    (u: AdminUser) => u.role === "ADMINISTRATOR" && u.isActive && activeAdminCount <= 1,
    [activeAdminCount]
  );

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      if (term && !(u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))) return false;
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !u.isActive) return false;
      if (statusFilter === "INACTIVE" && u.isActive) return false;
      return true;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const openCreate = () => {
    setForm(emptyForm());
    setFieldErrors({});
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = (target: AdminUser) => {
    setForm({
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      department: target.department ?? "",
      isActive: target.isActive,
      initialPassword: "",
    });
    setFieldErrors({});
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (isSaving) return;
    setDrawerOpen(false);
    setFormError(null);
    setFieldErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const name = form.name.trim();
    if (name.length < 2 || name.length > 100) errors.name = "Full name must be between 2 and 100 characters.";
    if (!EMAIL_REGEX.test(form.email.trim())) errors.email = "A valid email address is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      if (form.id) {
        const updated = await updateUser(form.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          department: form.department.trim() || null,
          isActive: form.isActive,
        });
        setNotice(`User "${updated.name}" updated successfully.`);
      } else {
        const created = await createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          department: form.department.trim() || null,
          isActive: form.isActive,
          initialPassword: form.initialPassword || undefined,
        });
        setNotice(`User "${created.name}" created. They must set a new password on first login.`);
      }
      setDrawerOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!form.id) return;
    setFormError(null);
    setIsSaving(true);
    try {
      const deactivated = await updateUser(form.id, { isActive: false });
      setNotice(`User "${deactivated.name}" deactivated.`);
      setDrawerOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to deactivate user.");
    } finally {
      setIsSaving(false);
    }
  };

  const openReset = (target: AdminUser) => {
    setResetTarget(target);
    setResetPassword(generateTempPassword());
    setResetError(null);
    setResetMessage(null);
  };

  const closeReset = () => {
    if (isResetting) return;
    setResetTarget(null);
  };

  const confirmReset = async () => {
    if (!resetTarget) return;
    setResetError(null);
    setResetMessage(null);
    setIsResetting(true);
    try {
      const result = await resetUserPassword(resetTarget.id, resetPassword);
      setResetMessage(result.message);
      await loadUsers();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setIsResetting(false);
    }
  };

  const drawerTarget = form.id ? users.find((u) => u.id === form.id) ?? null : null;
  const editingSelf = !!drawerTarget && isSelf(drawerTarget);
  const deactivateDisabled = !!drawerTarget && (editingSelf || isLastActiveAdmin(drawerTarget));

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h2 className="h3 fw-bold text-dark mb-1">Users</h2>
          <p className="text-muted small mb-0">Manage accounts, roles, and access status.</p>
        </div>
        <button id="create-user-btn" type="button" className="btn btn-zen-primary px-3" onClick={openCreate}>
          ＋ Create User
        </button>
      </div>

      {notice && (
        <div
          className="alert py-2 px-3 small mb-0"
          role="status"
          style={{ background: "#EAF6EF", color: "#006B3C", border: "1px solid #A7F3D0" }}
        >
          {notice}
        </div>
      )}

      {loadError && (
        <div className="alert alert-danger py-2 px-3 small mb-0" role="alert">
          {loadError}
        </div>
      )}

      <div className="card-zen p-3 d-flex flex-wrap gap-2 align-items-center">
        <input
          id="user-search"
          type="search"
          className="form-control flex-grow-1"
          style={{ minWidth: 220 }}
          placeholder="Search users..."
          aria-label="Search users"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          id="role-filter"
          className="form-select"
          style={{ width: 180 }}
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "ALL")}
        >
          <option value="ALL">All Roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          id="status-filter"
          className="form-select"
          style={{ width: 170 }}
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="card-zen overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-muted text-uppercase small">
                <th scope="col" className="ps-3">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-end pe-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">Loading users…</td>
                </tr>
              ) : pageUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    No users match your search filters
                  </td>
                </tr>
              ) : (
                pageUsers.map((user) => (
                  <tr key={user.id} data-testid="user-row">
                    <td className="ps-3 fw-semibold">{user.name}</td>
                    <td className="text-secondary">{user.email}</td>
                    <td><RoleBadge role={user.role} /></td>
                    <td><StatusBadge isActive={user.isActive} /></td>
                    <td className="text-end pe-3">
                      <div className="d-flex justify-content-end gap-2">
                        <button type="button" className="btn btn-sm btn-zen-outline" onClick={() => openEdit(user)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openReset(user)}>
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredUsers.length > PAGE_SIZE && (
          <div className="d-flex align-items-center justify-content-between border-top px-3 py-2">
            <small className="text-muted">
              Showing {pageUsers.length} of {filteredUsers.length} users
            </small>
            <nav aria-label="User directory pagination" className="d-flex align-items-center gap-1">
              <button type="button" className="btn btn-sm btn-light border" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                ‹ Prev
              </button>
              <span className="btn btn-sm btn-light border disabled">{currentPage} / {totalPages}</span>
              <button type="button" className="btn btn-sm btn-light border" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                Next ›
              </button>
            </nav>
          </div>
        )}
      </div>

      {drawerOpen && (
        <div
          className="modal show d-block"
          role="dialog"
          aria-modal="true"
          aria-labelledby="userDrawerTitle"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "0.75rem" }}>
              <div className="modal-header">
                <h5 id="userDrawerTitle" className="modal-title fw-bold">
                  {form.id ? "Edit User" : "Create New User"}
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeDrawer} disabled={isSaving} />
              </div>
              <form onSubmit={handleSave} noValidate>
                <div className="modal-body">
                  {formError && (
                    <div className="alert alert-danger py-2 px-3 small" role="alert">
                      {formError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="user-name" className="form-label fw-semibold small">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="user-name"
                      className={`form-control ${fieldErrors.name ? "is-invalid" : ""}`}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      disabled={isSaving}
                    />
                    {fieldErrors.name && <div className="text-danger small mt-1">{fieldErrors.name}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="user-email" className="form-label fw-semibold small">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <input
                      id="user-email"
                      type="email"
                      className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      disabled={isSaving}
                    />
                    {fieldErrors.email && <div className="text-danger small mt-1">{fieldErrors.email}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="user-role" className="form-label fw-semibold small">
                      Role <span className="text-danger">*</span>
                    </label>
                    <select
                      id="user-role"
                      className="form-select"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                      disabled={isSaving}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="user-department" className="form-label fw-semibold small">Department</label>
                    <input
                      id="user-department"
                      className="form-control"
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-check form-switch mb-3">
                    <input
                      id="user-active"
                      type="checkbox"
                      role="switch"
                      className="form-check-input"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      disabled={isSaving || editingSelf}
                    />
                    <label htmlFor="user-active" className="form-check-label fw-semibold small">
                      Active{editingSelf ? " (cannot deactivate your own account)" : ""}
                    </label>
                  </div>

                  {!form.id && (
                    <div className="mb-1">
                      <label htmlFor="user-initial-password" className="form-label fw-semibold small">
                        Initial Password
                      </label>
                      <input
                        id="user-initial-password"
                        className="form-control"
                        value={form.initialPassword}
                        onChange={(e) => setForm({ ...form, initialPassword: e.target.value })}
                        disabled={isSaving}
                      />
                      <div className="form-text">The user must change this on first login.</div>
                    </div>
                  )}
                </div>
                <div className="modal-footer flex-column align-items-stretch gap-2">
                  <button type="submit" className="btn btn-zen-primary" disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save User"}
                  </button>
                  {form.id && (
                    <button
                      type="button"
                      className="btn btn-zen-destructive-outline"
                      onClick={handleDeactivate}
                      disabled={isSaving || deactivateDisabled}
                    >
                      Deactivate User
                    </button>
                  )}
                  <button type="button" className="btn btn-link text-muted" onClick={closeDrawer} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div
          className="modal show d-block"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resetDialogTitle"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1070 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "0.75rem" }}>
              <div className="modal-header">
                <h5 id="resetDialogTitle" className="modal-title fw-bold">Reset Password</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeReset} disabled={isResetting} />
              </div>
              <div className="modal-body">
                <p className="small text-muted">
                  Set a new temporary password for <strong>{resetTarget.name}</strong>. The user must change it on next
                  login.
                </p>
                {resetError && (
                  <div className="alert alert-danger py-2 px-3 small" role="alert">{resetError}</div>
                )}
                {resetMessage && (
                  <div className="alert py-2 px-3 small" role="status" style={{ background: "#EAF6EF", color: "#006B3C" }}>
                    {resetMessage}
                  </div>
                )}
                <label htmlFor="reset-password-input" className="form-label fw-semibold small">
                  Temporary Password
                </label>
                <input
                  id="reset-password-input"
                  className="form-control"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  disabled={isResetting}
                />
                <div className="form-text">Min 8 chars with upper, lower, number and a special character.</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-link text-muted" onClick={closeReset} disabled={isResetting}>
                  Close
                </button>
                <button type="button" className="btn btn-zen-primary" onClick={confirmReset} disabled={isResetting}>
                  {isResetting ? "Resetting…" : "Reset Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
