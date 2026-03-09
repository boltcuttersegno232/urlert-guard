/**
 * Lightweight content script that runs ONLY on urlert.com pages.
 *
 * Its sole job is to listen for the auth-token postMessage that the
 * /extension/auth page sends after the user logs in, and forward it to the
 * background script for storage.
 *
 * Expected message from the page:
 *   window.postMessage({
 *     type:    'URLERT_EXTENSION_AUTH',
 *     payload: { token, email, expires_at }
 *   }, window.location.origin);
 */

const TRUSTED_ORIGINS = [
  'https://www.urlert.com',
  'https://urlert.com',
];

// In dev mode, also trust localhost
if (import.meta.env.DEV) {
  TRUSTED_ORIGINS.push('http://localhost:5173', 'http://127.0.0.1:5173');
}

export default defineContentScript({
  matches: [
    '*://www.urlert.com/*',
    '*://urlert.com/*',
    // Dev: SvelteKit dev server (only included in dev builds)
    ...(import.meta.env.DEV
      ? ['http://localhost:5173/*', 'http://127.0.0.1:5173/*']
      : []),
  ],
  runAt: 'document_idle',

  main() {
    window.addEventListener('message', (event: MessageEvent) => {
      // Only accept messages from the trusted page origin
      if (!TRUSTED_ORIGINS.includes(event.origin)) return;

      const data = event.data;
      if (data?.type !== 'URLERT_EXTENSION_AUTH') return;

      const payload = data.payload;
      if (!payload?.token || !payload?.email) {
        console.warn('URLert: received auth message with missing fields');
        return;
      }

      // Forward to background script for storage
      browser.runtime.sendMessage({
        type: 'URLERT_AUTH_TOKEN',
        payload: {
          token: payload.token,
          email: payload.email,
          expires_at: payload.expires_at,
        },
      }).then(() => {
        console.log('URLert: auth token forwarded to background');
      }).catch((err) => {
        console.error('URLert: failed to forward auth token', err);
      });
    });
  },
});
