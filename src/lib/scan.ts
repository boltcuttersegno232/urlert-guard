/**
 * On-demand URL scan types and state management.
 *
 * Flow:
 *  1. User clicks "Scan this page" in the popup (requires auth).
 *  2. Background script captures screenshot + page HTML.
 *  3. Payload is POSTed to the API → returns a job ID.
 *  4. Extension polls the job status until it completes.
 *  5. User is notified of the result.
 */

import type { components } from './types/api.generated';

// ── Types (from api.generated.ts) ─────────────────────────────────────────────

/** POST /extensions/scan – request body. */
export type ScanRequest = components['schemas']['ScanRequest'];

/** POST /extensions/scan – 202 response (job_id + status_url). */
export type ScanInitResponse = components['schemas']['SubscriptionJobInitResponse'];

/** GET /extensions/scan/{job_id} – poll response. */
export type ScanStatusResponse = components['schemas']['SubscriptionJobStatusResponse_ExtensionScanResult_'];

/** Server-side scan job status. */
export type ScanJobStatus = components['schemas']['SubscriptionJobStatus'];

/** The result object returned when a scan completes. */
export type ExtensionScanResult = components['schemas']['ExtensionScanResult'];

/** User-facing safety classification. */
export type SafetyLevel = components['schemas']['SafetyLevel'];

/**
 * Local status adds "pending" to represent the interval between submission
 * and the first poll response from the server.
 */
export type ActiveScanStatus = 'pending' | ScanJobStatus;

// ── Storage helpers ────────────────────────────────────────────────────────────

const ACTIVE_SCAN_KEY = 'urlertActiveScan';

export interface ActiveScan {
  job_id: string;
  url: string;
  domain: string;
  submitted_at: string;
  status: ActiveScanStatus;
  result?: ExtensionScanResult | null;
  error?: string | null;
  error_status?: number | null;
}

/** Persist the active scan so the popup can resume polling after re-open. */
export async function saveActiveScan(scan: ActiveScan): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_SCAN_KEY]: scan });
}

/** Get the current active scan (if any). */
export async function getActiveScan(): Promise<ActiveScan | null> {
  const data = await browser.storage.local.get(ACTIVE_SCAN_KEY);
  return (data[ACTIVE_SCAN_KEY] as ActiveScan) ?? null;
}

/** Clear the active scan (user dismissed or it expired). */
export async function clearActiveScan(): Promise<void> {
  await browser.storage.local.remove(ACTIVE_SCAN_KEY);
}

// ── Scan history ───────────────────────────────────────────────────────────

const SCAN_HISTORY_KEY = 'urlertScanHistory';
const MAX_HISTORY_ITEMS = 30;

export interface ScanHistoryItem {
  job_id: string;
  url: string;
  domain: string;
  scanned_at: string;
  result: ExtensionScanResult;
}

/** Prepend a completed scan to the persisted history (capped at MAX_HISTORY_ITEMS). */
export async function addScanToHistory(item: ScanHistoryItem): Promise<void> {
  const history = await getScanHistory();
  // Dedup by job_id so re-saves don't create duplicates
  const filtered = history.filter(h => h.job_id !== item.job_id);
  const updated = [item, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  await browser.storage.local.set({ [SCAN_HISTORY_KEY]: updated });
}

/** Get the full scan history (newest first). */
export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  const data = await browser.storage.local.get(SCAN_HISTORY_KEY);
  return (data[SCAN_HISTORY_KEY] as ScanHistoryItem[]) ?? [];
}

/** Clear all stored scan history. */
export async function clearScanHistory(): Promise<void> {
  await browser.storage.local.remove(SCAN_HISTORY_KEY);
}
