import { urlert } from '$lib/api';
import {
  saveActiveScan,
  getActiveScan,
  clearActiveScan,
  addScanToHistory,
  getScanHistory,
  clearScanHistory,
} from '$lib/scan';
import type { ActiveScan, ExtensionScanResult } from '$lib/scan';

// Badge colours per safety level.
const BADGE_COLOR: Record<string, string> = {
  safe: '#10b981',    // emerald-500
  caution: '#f59e0b', // amber-500
  danger: '#ef4444',  // red-500
  pending: '#6366f1', // indigo-500
};

// ── Helpers ────────────────────────────────────────────────────────────────

function setBadge(text: string, color: string) {
  browser.action.setBadgeText({ text });
  browser.action.setBadgeBackgroundColor({ color });
}

function clearBadge() {
  browser.action.setBadgeText({ text: '' });
}

/**
 * Persist a completed scan to history.
 */
async function handleScanCompletion(
  activeScan: ActiveScan,
  result: ExtensionScanResult,
): Promise<void> {
  // Save to history
  await addScanToHistory({
    job_id: activeScan.job_id,
    url: activeScan.url,
    domain: activeScan.domain,
    scanned_at: new Date().toISOString(),
    result,
  });

  // Update badge to reflect result
  const color = BADGE_COLOR[result.safety_level] ?? BADGE_COLOR.pending;
  const badgeText =
    result.safety_level === 'safe' ? '✓' : result.safety_level === 'caution' ? '!' : '✕';
  setBadge(badgeText, color);

  await saveActiveScan(activeScan);
}

// ── Message handler ────────────────────────────────────────────────────────

/**
 * Handle on-demand scan messages from the popup.
 * Returns `true` if the message was handled (async response), `false` otherwise.
 */
export function handleScanMessage(
  message: any,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  // Popup requests a scan of the active tab.
  if (message.type === 'URLERT_SCAN_REQUEST') {
    (async () => {
      let url = '';
      let domain = '';
      try {
        const payload = message.payload as {
          url: string;
          tabId: number;
          screenshot?: string;
        };
        url = payload.url;
        const tabId = payload.tabId;
        const screenshot = payload.screenshot;
        domain = new URL(url).hostname;

        // Show "scanning" badge
        setBadge('…', BADGE_COLOR.pending);

        // Ask the content script for the page HTML
        let html = '';
        try {
          const htmlResponse = await browser.tabs.sendMessage(tabId, {
            type: 'URLERT_GET_PAGE_HTML',
          });
          html = htmlResponse?.html ?? '';

          // Truncate HTML to ~1MB to prevent large API payloads and memory issues
          const MAX_HTML_LENGTH = 1024 * 1024;
          if (html.length > MAX_HTML_LENGTH) {
            html = html.slice(0, MAX_HTML_LENGTH);
          }
        } catch {
          console.warn('URLert: could not capture page HTML');
        }

        // Submit to API
        const response = await urlert.submitScan({
          url,
          html,
          screenshot_base64: screenshot ?? '',
        });

        // Store active scan for persistence across popup reopens
        const activeScan: ActiveScan = {
          job_id: response.job_id,
          url,
          domain,
          submitted_at: new Date().toISOString(),
          status: 'pending',
        };
        await saveActiveScan(activeScan);

        sendResponse({ success: true, job_id: response.job_id });
      } catch (err: any) {
        console.error('URLert: scan request failed', err);
        clearBadge();
        sendResponse({ success: false, error: err?.message ?? 'Scan failed', status: err?.status });
      }
    })();
    return true;
  }

  // Popup polls for scan job status.
  if (message.type === 'URLERT_SCAN_STATUS') {
    (async () => {
      try {
        const { job_id } = message.payload as { job_id: string };
        const statusResponse = await urlert.getScanStatus(job_id);

        // Update stored scan state
        const activeScan = await getActiveScan();
        if (activeScan && activeScan.job_id === job_id) {
          activeScan.status = statusResponse.status;
          if (statusResponse.result) activeScan.result = statusResponse.result;
          if (statusResponse.error) activeScan.error = statusResponse.error;
          
          if (statusResponse.status !== 'failed') {
            await saveActiveScan(activeScan);
          } else {
            // Do not persist failure across popup re-opens
            await clearActiveScan();
          }

          // Handle completion (saves history, fires notification, updates badge)
          if (statusResponse.status === 'complete' && statusResponse.result) {
            await handleScanCompletion(activeScan, statusResponse.result);
          } else if (statusResponse.status === 'failed') {
            clearBadge();
          }
        }

        sendResponse(statusResponse);
      } catch (err: any) {
        console.error('URLert: scan status poll failed', err);
        sendResponse({ status: 'failed', error: err?.message ?? 'Poll failed' });
      }
    })();
    return true;
  }

  // Popup requests the stored active scan (to resume UI on re-open).
  if (message.type === 'URLERT_GET_ACTIVE_SCAN') {
    getActiveScan().then(sendResponse);
    return true;
  }

  // Popup dismisses / clears the active scan.
  if (message.type === 'URLERT_CLEAR_ACTIVE_SCAN') {
    clearActiveScan()
      .then(() => {
        clearBadge();
        sendResponse({ success: true });
      });
    return true;
  }

  // Popup requests scan history.
  if (message.type === 'URLERT_GET_SCAN_HISTORY') {
    getScanHistory().then(sendResponse);
    return true;
  }

  // Popup clears scan history.
  if (message.type === 'URLERT_CLEAR_SCAN_HISTORY') {
    clearScanHistory().then(() => sendResponse({ success: true }));
    return true;
  }

  return false;
}
