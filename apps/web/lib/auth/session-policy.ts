// BrewCC/BrewCC session policy.
// - Idle: the session cookie lives SESSION_IDLE_TIMEOUT_SECONDS and is extended while the
//   user is active (the dashboard refreshes it at most every SESSION_REFRESH_INTERVAL_MS),
//   so an unused dashboard signs out after an hour.
// - Absolute: whatever the activity, a login is valid at most SESSION_MAX_AGE_MS.

export const SESSION_IDLE_TIMEOUT_SECONDS = 60 * 60; // 1 hour
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// shared between tabs, so activity in one tab keeps the others signed in
export const LAST_ACTIVITY_STORAGE_KEY = "brew-last-activity";

export const SESSION_EXPIRED_ERROR = "session-expired";

// login timestamp kept in the JWT; tokens from before this policy start counting now
export function loginStartedAt(token: object, now = Date.now()) {
  const loginAt = (token as { loginAt?: unknown }).loginAt;
  return typeof loginAt === "number" ? loginAt : now;
}

export function isPastMaxAge(loginAt: number, now = Date.now()) {
  return now - loginAt > SESSION_MAX_AGE_MS;
}
