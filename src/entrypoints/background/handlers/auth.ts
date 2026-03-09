import { saveAuthState, clearAuthState, getAuthState } from '$lib/auth';

const TRUSTED_AUTH_ORIGINS = [
  'https://www.urlert.com',
  'https://urlert.com',
  ...(import.meta.env.DEV
    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
    : []),
];

/**
 * Handle auth-related messages from content scripts and the popup.
 * Returns `true` if the message was handled (async response), `false` otherwise.
 */
export function handleAuthMessage(
  message: any,
  sender: Browser.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  // Auth token received from auth-listener content script on urlert.com.
  if (message.type === 'URLERT_AUTH_TOKEN' && message.payload) {
    // Only accept tokens from content scripts running on trusted origins.
    const senderUrl = sender.tab?.url;
    if (!senderUrl || !TRUSTED_AUTH_ORIGINS.includes(new URL(senderUrl).origin)) {
      console.warn('URLert: rejected auth token from untrusted origin', senderUrl);
      sendResponse({ success: false });
      return true;
    }

    const { token, email, expires_at } = message.payload;
    saveAuthState({ token, email, expires_at })
      .then(() => {
        console.log('URLert: auth state saved');
        sendResponse({ success: true });
      })
      .catch((err) => {
        console.error('URLert: failed to save auth state', err);
        sendResponse({ success: false });
      });
    return true;
  }

  // Popup requests current auth state.
  if (message.type === 'GET_AUTH_STATE') {
    getAuthState().then(sendResponse);
    return true;
  }

  // Popup requests logout.
  if (message.type === 'URLERT_LOGOUT') {
    clearAuthState().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
}
