import bcrypt from "bcryptjs";

/**
 * Password policy (Lab 3, BR-03 / BR-04).
 * - Minimum 8 characters, maximum 100 characters.
 * - At least one uppercase letter, one lowercase letter, one digit, one special.
 * - Hashed with bcrypt using a salt cost >= 10 rounds.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;
export const BCRYPT_SALT_ROUNDS = 10;

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const DIGIT_REGEX = /[0-9]/;
// Any character that is not a letter or digit counts as a "special" character.
const SPECIAL_REGEX = /[^A-Za-z0-9]/;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a plaintext candidate password against the complexity policy.
 * Returns every violated rule so the API can surface actionable details.
 */
export function validatePasswordComplexity(password: unknown): PasswordValidationResult {
  const errors: string[] = [];

  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, errors: ["Password is required."] };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters long.`);
  }
  if (!UPPERCASE_REGEX.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!LOWERCASE_REGEX.test(password)) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!DIGIT_REGEX.test(password)) {
    errors.push("Password must contain at least one number.");
  }
  if (!SPECIAL_REGEX.test(password)) {
    errors.push("Password must contain at least one special character.");
  }

  return { valid: errors.length === 0, errors };
}

/** Hashes a plaintext password using bcrypt (salt rounds = 10). */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS);
}

/** Constant-time comparison of a plaintext password against a bcrypt hash. */
export async function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  if (!plainText || !passwordHash) return false;
  try {
    return await bcrypt.compare(plainText, passwordHash);
  } catch {
    return false;
  }
}
