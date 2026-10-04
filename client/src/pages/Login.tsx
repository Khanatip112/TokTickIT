import React, { ChangeEvent, FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { useRouter } from "../router.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Screen 1 — Login (`/login`) per ui-spec.md §4.1.
 * Email + password credentials, client-side validation, inline error banner,
 * a password visibility toggle, busy submit state, and a "Forgot your password?"
 * helper popover.
 */
export const Login: React.FC = () => {
  const { login } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const validate = (): boolean => {
    const next: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = "Email address is required.";
    else if (!EMAIL_REGEX.test(trimmedEmail)) next.email = "Please enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Invalid email or password. Please try again.";
      setFormError(message);
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page d-flex flex-column align-items-center justify-content-center min-vh-100 px-3 py-5">
      <div className="auth-card card-zen w-100" style={{ maxWidth: 420, padding: 0, overflow: "hidden" }}>
        {/* Zen Green brand banner */}
        <div
          className="text-center text-white py-4 px-3"
          style={{ background: "linear-gradient(135deg, #006B3C 0%, #0B7A46 100%)" }}
        >
          <div className="fs-2 mb-1" aria-hidden="true">🎫</div>
          <h1 className="h4 fw-bold mb-0 text-white">TokTickIT</h1>
          <span className="opacity-75" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
            IT SERVICE DESK
          </span>
        </div>

        <div className="p-4">
          <h2 className="h5 fw-bold text-zen-primary mb-1">Sign in to your account</h2>
          <p className="text-muted small mb-4">Enter your credentials to access the service desk.</p>

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

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="login-email" className="form-label fw-semibold small">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                autoFocus
                className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                disabled={isSubmitting}
                placeholder="you@toktickit.com"
              />
              {fieldErrors.email && <div className="text-danger small mt-1">{fieldErrors.email}</div>}
            </div>

            <div className="mb-2">
              <label htmlFor="login-password" className="form-label fw-semibold small">
                Password
              </label>
              <div className="position-relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`form-control pe-5 ${fieldErrors.password ? "is-invalid" : ""}`}
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="btn btn-sm position-absolute top-50 end-0 translate-middle-y text-muted border-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isSubmitting}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              {fieldErrors.password && (
                <div className="text-danger small mt-1">{fieldErrors.password}</div>
              )}
            </div>

            <button
              type="submit"
              className={`btn btn-zen-primary w-100 mt-3 py-2 ${isSubmitting ? "btn-busy" : ""}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Signing In…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="text-center mt-3">
            <button
              type="button"
              className="btn btn-link p-0 small text-zen-primary text-decoration-none"
              onClick={() => setShowForgot(true)}
            >
              Forgot your password?
            </button>
          </div>
        </div>
      </div>

      {showForgot && (
        <div
          className="modal show d-block"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgotPasswordTitle"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
          onClick={() => setShowForgot(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "0.75rem" }}>
              <div className="modal-header">
                <h5 id="forgotPasswordTitle" className="modal-title fw-bold">
                  Password assistance
                </h5>
              </div>
              <div className="modal-body text-secondary small">
                Please contact your TokTickIT Administrator to reset your temporary password.
              </div>
              <div className="modal-footer border-top-0">
                <button className="btn btn-zen-primary" onClick={() => setShowForgot(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
