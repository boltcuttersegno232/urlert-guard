import type { components } from './types/api.generated';
import { DomainCache } from './cache';
import { getAuthState } from './auth';
import { getDomain } from 'tldts';
import type { ScanRequest, ScanInitResponse, ScanStatusResponse } from './scan';

export type DomainClassification = components["schemas"]["DomainClassificationResponse"];
export type ExtensionReportRequest = components["schemas"]["ExtensionReportRequest"];
export type ExtensionReportResponse = components["schemas"]["ExtensionReportResponse"];

export class UrlertApi {
  // Use import.meta.env.DEV to detect development mode in WXT/Vite
  private baseUrl = import.meta.env.DEV 
    ? 'http://127.0.0.1:8000/extensions' 
    : 'https://api.urlert.com/extensions';

  private cachedInstallId: string | null = null;

  private cache = new DomainCache<DomainClassification>({
    storageKey: 'domainCache',
    ttlHit:  10 * 60 * 1000, // 10 min for known domains
    // 40 s for a 404 — backend scan completes in ~30 s, so this entry will
    // expire shortly after the scan, letting a normal re-fetch pick up the result.
    ttlMiss:  40 * 1000,
  });

  private async getInstallId(): Promise<string> {
    if (this.cachedInstallId) return this.cachedInstallId;

    try {
      const data = await browser.storage.local.get({ installId: '' });
      const installId = data.installId as string;
      
      if (installId) {
        this.cachedInstallId = installId;
        return installId;
      }

      const newId = crypto.randomUUID();
      await browser.storage.local.set({ installId: newId });
      this.cachedInstallId = newId;
      return newId;
    } catch (e) {
      console.error('Error managing installId:', e);
      return 'anonymous';
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const extensionId = browser.runtime.id;
    const version = browser.runtime.getManifest().version;
    const installId = await this.getInstallId();

    const headers: Record<string, string> = {
      'X-Urlert-Guard-Source': 'extension',
      'X-Urlert-Extension-ID': extensionId,
      'X-Urlert-Install-ID': installId,
      'X-Urlert-Version': version,
      'Accept': 'application/json',
    };

    // Attach Bearer token when the user is logged in
    try {
      const auth = await getAuthState();
      if (auth?.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }
    } catch {
      // Not logged in — continue without auth header
    }

    return headers;
  }

  async classifyDomain(domain: string): Promise<DomainClassification | null> {
    // Normalize to eTLD+1 so subdomains are not leaked and cache keys are consistent.
    const registered = getDomain(domain) ?? domain;
    return this.cache.getOrFetch(registered, () => this._fetchClassification(registered));
  }

  /**
   * Bypass the cache, re-fetch from the API, and update the cache.
   * Called after the backend scan window (≈35 s — see SCAN_RETRY_DELAY_MS).
   * On success the result is stored with the normal hit TTL (10 min).
   * On continued 404 a short miss TTL is written (2 min) to keep retries infrequent.
   */
  async forceRefreshClassification(domain: string): Promise<DomainClassification | null> {
    const registered = getDomain(domain) ?? domain;
    await this.cache.invalidate(registered);
    const result = await this._fetchClassification(registered);
    const ttl = result != null
      ? 10 * 60 * 1000  // known domain — cache for 10 min
      : 2 * 60 * 1000;  // still unknown — back off for 2 min
    await this.cache.set(registered, result, ttl);
    return result;
  }

  private async _fetchClassification(domain: string): Promise<DomainClassification | null> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/domain-classification/${domain}`, {
        headers,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Urlert API error:', error);
      return null;
    }
  }

  // ── On-demand scan ─────────────────────────────────────────────────────────

  /**
   * Submit an on-demand URL scan.
   * Requires authentication — the backend will reject unauthenticated requests.
   * Returns a job ID and status URL that can be polled via getScanStatus().
   */
  async submitScan(submission: ScanRequest): Promise<ScanInitResponse> {
    const headers = await this.getHeaders();
    headers['Content-Type'] = 'application/json';

    const response = await fetch(`${this.baseUrl}/scan`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      let message = `Scan submit failed (${response.status})`;
      try {
        const json = await response.json();
        if (json.detail) message = json.detail;
      } catch {
        const text = await response.text().catch(() => '');
        if (text) message = `${message}: ${text}`;
      }
      const error = new Error(message);
      (error as any).status = response.status;
      throw error;
    }

    return await response.json();
  }

  /**
   * Poll the status of a previously submitted scan job.
   */
  async getScanStatus(jobId: string): Promise<ScanStatusResponse> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/scan/${jobId}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Scan status failed (${response.status})`);
    }

    return await response.json();
  }

  // ── URL Report ──────────────────────────────────────────────────────────────

  /**
   * Submit a threat report for a URL.
   * Creates a public discussion post on URLert. Does not require auth
   * (install_id is used for fingerprinting).
   */
  async submitReport(report: ExtensionReportRequest): Promise<ExtensionReportResponse> {
    const headers = await this.getHeaders();
    headers['Content-Type'] = 'application/json';

    const response = await fetch(`${this.baseUrl}/report`, {
      method: 'POST',
      headers,
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Report submit failed (${response.status}): ${text}`);
    }

    return await response.json();
  }

  // ── Subscription ─────────────────────────────────────────────────────────────

  private cachedSubscription: components["schemas"]["SubscriptionResponse"] | null = null;
  private lastSubFetch = 0;
  private readonly SUB_CACHE_TTL = 60 * 1000; // 1 minute memory cache

  /**
   * Get the current user's subscription details.
   */
  async getSubscription(forceRefresh = false): Promise<components["schemas"]["SubscriptionResponse"]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedSubscription && (now - this.lastSubFetch < this.SUB_CACHE_TTL)) {
      return this.cachedSubscription;
    }

    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/subscription`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Subscription status failed (${response.status})`);
    }

    this.cachedSubscription = await response.json();
    this.lastSubFetch = now;
    return this.cachedSubscription!;
  }

  /** Clear the cached subscription data (e.g. on logout) */
  clearSubscriptionCache(): void {
    this.cachedSubscription = null;
  }
}

export type SubscriptionResponse = components["schemas"]["SubscriptionResponse"];

export const urlert = new UrlertApi();


