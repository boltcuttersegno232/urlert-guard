/**
 * Extension auth state management.
 *
 * The extension never sees user_id or organization_id — those stay on the
 * server. The opaque token maps to the user's identity via Redis on the
 * FastAPI backend.
 *
 * Flow:
 *  1. User clicks "Sign in" in the popup → opens www.urlert.com/extension/auth
 *  2. User logs in on the website (existing SvelteKit auth + Altcha).
 *  3. SvelteKit calls the FastAPI backend to generate an extension token.
 *  4. The page posts the token to the content script:
 *       window.postMessage({
 *         type:    'URLERT_EXTENSION_AUTH',
 *         payload: { token, email, expires_at }
 *       }, window.location.origin);
 *  5. The auth-listener content script forwards it to the background script.
 *  6. The background script stores the auth state via saveAuthState().
 *  7. Next time the popup opens, it reads the state with getAuthState().
 */

export interface AuthState {
  /** Opaque token — backend maps it to user_id via Redis */
  token: string;
  /** Email shown in the UI (display only, not used for auth) */
  email: string;
  /** ISO-8601 timestamp — client-side expiry check */
  expires_at: string;
}

const AUTH_STORAGE_KEY = 'urlertAuth';

/** Retrieve the stored auth state, or null if not logged in / expired. */
export async function getAuthState(): Promise<AuthState | null> {
  try {
    const data = await browser.storage.local.get(AUTH_STORAGE_KEY);
    const state = data[AUTH_STORAGE_KEY] as AuthState | undefined;
    if (!state?.token) return null;

    // Client-side expiry check
    if (state.expires_at && new Date(state.expires_at) < new Date()) {
      await clearAuthState();
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/** Persist auth state after a successful login. */
export async function saveAuthState(state: AuthState): Promise<void> {
  await browser.storage.local.set({ [AUTH_STORAGE_KEY]: state });
}

/** Clear auth state (logout). */
export async function clearAuthState(): Promise<void> {
  await browser.storage.local.remove(AUTH_STORAGE_KEY);
}
