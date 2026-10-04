import React, { FormEvent, useState } from "react";
import { needsPasswordChange, useAuth } from "../context/AuthContext.js";
import { useRouter } from "../router.js";
import { PasswordChecklist, passwordMeetsPolicy } from "../components/PasswordChecklist.js";
import { PasswordField } from "../components/PasswordField.js";

/**
 * Screen 2 — Mandatory First-Login Password Change (`/change-password`)
 * per ui-spec.md §4.2. Also reused as the voluntary "Change Password" screen
 * from the profile menu.
 */
export const ChangePassword: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const { navigate } = useRouter();

  const forced = needsPasswordChange(user);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visibility, setVisibility] = useState({ current: false, next: false, confirm: false });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const toggleVisibility = (key: "current" | "next" | "confirm") =>
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!currentPassword) next.currentPassword = "Current password is required.";
    if (!newPassword) next.newPassword = "New password is required.";
    else if (!passwordMeetsPolicy(newPassword))
      next.newPassword = "New password does not meet all of the requirements below.";
    if (!confirmPassword) next.confirmPassword = "Please confirm your new password.";
    else if (confirmPassword !== newPassword) next.confirmPassword = "Passwords do not match.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/");
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Failed to change password. Please try again.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="auth-page d-flex flex-column align-items-center justify-content-center min-vh-100 px-3 py-5">
      <div className="auth-card card-zen w-100" style={{ maxWidth: 480, padding: 0, overflow: "hidden" }}>
        <div
          className="py-4 px-4 text-white"
          style={{ background: "linear-gradient(135deg, #006B3C 0%, #0B7A46 100%)" }}
        >
          <h1 className="h4 fw-bold mb-1 text-white">Change Your Password</h1>
          <p className="mb-0 small opacity-75">
            {forced
              ? "You must change your password to continue."
              : "Choose a new password for your account."}
          </p>
        </div>

        <div className="p-4">
          {forced && (
            <div
              className="alert small mb-3"
              role="status"
              style={{ background: "#EAF6EF", color: "#006B3C", border: "1px solid #A7F3D0" }}
            >
              For your security, please set a new password before continuing.
            </div>
          )}

          {formError && (
            <div
              className="alert d-flex align-items-start gap-2 mb-3"
              role="alert"
              style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5" }}
            >
              <span aria-hidden="true">⚠️</span>
              <span className="small fw-semibold">{formError}</span>
            </div>
          )}

          {success && (
            <div
              className="alert small mb-3"
              role="status"
              style={{ background: "#D1FAE5", color: "#047857", border: "1px solid #6EE7B7" }}
            >
              Password updated successfully.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <PasswordField
              id="change-current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              visible={visibility.current}
              onToggle={() => toggleVisibility("current")}
              error={fieldErrors.currentPassword}
              disabled={isSubmitting}
              autoFocus
            />

            <PasswordField
              id="change-new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              visible={visibility.next}
              onToggle={() => toggleVisibility("next")}
              error={fieldErrors.newPassword}
              disabled={isSubmitting}
            />

            <PasswordChecklist password={newPassword} className="mb-3" />

            <PasswordField
              id="change-confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={visibility.confirm}
              onToggle={() => toggleVisibility("confirm")}
              error={fieldErrors.confirmPassword}
              disabled={isSubmitting}
            />

            <button
              type="submit"
              className={`btn btn-zen-primary w-100 py-2 mt-2 ${isSubmitting ? "btn-busy" : ""}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <div className="text-center mt-3">
            {forced ? (
              <button type="button" className="btn btn-link p-0 small text-muted" onClick={handleSignOut}>
                Sign out instead
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-link p-0 small text-zen-primary text-decoration-none"
                onClick={() => navigate("/")}
              >
                ← Back to My Tickets
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

