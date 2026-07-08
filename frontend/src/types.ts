/**
 * Authenticated console user, restored from the httpOnly session cookie via
 * GET /v1/auth/me. `apiKey` is only present in memory right after
 * registration or key rotation — it is never persisted in the browser.
 */
export interface SessionUser {
  email: string;
  tier: string;
  apiKey?: string;
}
