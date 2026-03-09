<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { AuthState } from "$lib/auth";
  import type {
    ActiveScan,
    ScanStatusResponse,
    ExtensionScanResult,
    ScanHistoryItem,
  } from "$lib/scan";

  import ScanAuthGate from "./scan/ScanAuthGate.svelte";
  import ScanConfirm from "./scan/ScanConfirm.svelte";
  import ScanProgress from "./scan/ScanProgress.svelte";
  import ScanResult from "./scan/ScanResult.svelte";
  import ScanError from "./scan/ScanError.svelte";
  import ScanHistory from "./scan/ScanHistory.svelte";
  import ReportView from "./ReportView.svelte";
  import SubscriptionStatus from "$lib/components/settings/SubscriptionStatus.svelte";
  import type { SubscriptionResponse } from "$lib/api";

  interface Props {
    url: string;
    domain: string;
    tabId: number;
    screenshot?: string | null;
    authState: AuthState | null;
    openSignIn: () => void;
    focusJobId?: string | null;
    onFocusConsumed?: () => void;
  }

  let {
    url,
    domain,
    tabId,
    screenshot,
    authState,
    openSignIn,
    focusJobId,
    onFocusConsumed,
  }: Props = $props();

  let subscription = $state<SubscriptionResponse | null>(null);
  let subLoading = $state(false);

  // ── State machine ──────────────────────────────────────────────────────────
  type ScanPhase =
    | "idle"
    | "submitting"
    | "polling"
    | "completed"
    | "failed"
    | "reporting";

  let phase = $state<ScanPhase>("idle");
  let jobId = $state<string | null>(null);
  let result = $state<ExtensionScanResult | null>(null);
  let errorMsg = $state<string | null>(null);
  let errorStatus = $state<number | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let elapsedSeconds = $state(0);
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  /** True while a scan is active or result is shown; hides history panel. */
  let historyKey = $state(0); // increment to force ScanHistory to reload

  const POLL_INTERVAL_MS = 4_000;
  const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

  // On mount, check if there's an existing active scan for this URL
  onMount(async () => {
    try {
      const active: ActiveScan | null = await browser.runtime.sendMessage({
        type: "URLERT_GET_ACTIVE_SCAN",
      });

      if (active && active.url === url) {
        jobId = active.job_id;

        if (active.status === "complete" && active.result) {
          result = active.result;
          phase = "completed";
        } else if (active.status === "failed") {
          errorMsg = active.error ?? "Scan failed";
          phase = "failed";
        } else {
          phase = "polling";
          startPolling();
        }
      }
    } catch {
      // No active scan — stay idle
    }
  });

  onDestroy(() => stopPolling());

  // ── Actions ────────────────────────────────────────────────────────────────

  async function submitScan() {
    phase = "submitting";
    errorMsg = null;

    try {
      const response = await browser.runtime.sendMessage({
        type: "URLERT_SCAN_REQUEST",
        payload: { url, tabId, screenshot: screenshot ?? undefined },
      });

      if (!response?.success) {
        const error = new Error(response?.error ?? "Failed to submit scan");
        (error as any).status = response?.status;
        throw error;
      }

      jobId = response.job_id;
      phase = "polling";
      startPolling();
    } catch (err: any) {
      errorMsg = err?.message ?? "Failed to submit scan";
      errorStatus = err?.status ?? null;
      phase = "failed";
    }
  }

  function startPolling() {
    elapsedSeconds = 0;
    elapsedTimer = setInterval(() => {
      elapsedSeconds += 1;
    }, 1000);

    pollTimer = setInterval(async () => {
      if (!jobId) return;

      if (elapsedSeconds * 1000 > MAX_POLL_DURATION_MS) {
        errorMsg = "Scan timed out. Please try again later.";
        phase = "failed";
        stopPolling();
        return;
      }

      try {
        const status: ScanStatusResponse = await browser.runtime.sendMessage({
          type: "URLERT_SCAN_STATUS",
          payload: { job_id: jobId },
        });

        if (status.status === "complete" && status.result) {
          result = status.result;
          phase = "completed";
          stopPolling();
        } else if (status.status === "failed") {
          errorMsg = status.error ?? "Scan failed on the server";
          phase = "failed";
          stopPolling();
        }
      } catch {
        // Transient error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  $effect(() => {
    if (focusJobId) {
      loadSpecificJob(focusJobId);
    }
  });

  async function loadSpecificJob(id: string) {
    try {
      // 1. Check if it is the current active scan
      const active = await browser.runtime.sendMessage({
        type: "URLERT_GET_ACTIVE_SCAN",
      });
      if (active && active.job_id === id) {
        jobId = active.job_id;
        if (active.status === "complete" && active.result) {
          result = active.result;
          phase = "completed";
        } else if (active.status === "failed") {
          errorMsg = active.error ?? "Scan failed";
          phase = "failed";
        } else {
          phase = "polling";
          startPolling();
        }
        onFocusConsumed?.();
        return;
      }

      // 2. Check history
      const history = await browser.runtime.sendMessage({
        type: "URLERT_GET_SCAN_HISTORY",
      });
      const item = (history as ScanHistoryItem[]).find((h) => h.job_id === id);
      if (item) {
        viewHistoricalResult(item);
        onFocusConsumed?.();
        return;
      }
    } catch (e) {
      console.error("Failed to load specific job", e);
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  async function dismiss() {
    await browser.runtime.sendMessage({ type: "URLERT_CLEAR_ACTIVE_SCAN" });
    phase = "idle";
    jobId = null;
    result = null;
    errorMsg = null;
    errorStatus = null;
    historyKey += 1; // reload history so the just-completed scan appears
  }

  /** View a historical scan result directly without submitting a new scan. */
  function viewHistoricalResult(item: ScanHistoryItem) {
    result = item.result;
    phase = "completed";
    // No active scan in background — dismiss just resets phase without clearing storage
    jobId = null;
  }

  /** Open the report view with the current scan result pre-filled. */
  function openReport() {
    phase = "reporting";
  }

  /** Return from report view back to scan result. */
  function closeReport() {
    if (result) {
      phase = "completed";
    } else {
      phase = "idle";
    }
  }

  /** Whether the history panel should be shown. */
  const showHistory = $derived(
    !!authState && (phase === "idle" || phase === "failed"),
  );
</script>

<div
  class="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-1 duration-250"
>
  {#if !authState}
    <ScanAuthGate {openSignIn} />
  {:else}
    {#if phase === "idle"}
      <SubscriptionStatus
        bind:subscription
        bind:loading={subLoading}
        compact={true}
      />
    {/if}

    {#if phase === "idle"}
      <ScanConfirm
        {domain}
        onsubmit={submitScan}
        disabled={subscription !== null && !subscription.is_active}
      />
    {:else if phase === "submitting" || phase === "polling"}
      <ScanProgress {phase} {domain} {elapsedSeconds} />
    {:else if phase === "completed" && result}
      <ScanResult {result} ondismiss={dismiss} onreport={openReport} />
    {:else if phase === "reporting"}
      <ReportView {url} scanResult={result} onclose={closeReport} />
    {:else if phase === "failed"}
      <ScanError
        {errorMsg}
        status={errorStatus}
        ondismiss={dismiss}
        onretry={submitScan}
      />
    {/if}
  {/if}

  {#if showHistory}
    <div class="mt-2">
      <div class="h-px bg-white/[0.05] mb-3"></div>
      <p
        class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-0.5"
      >
        Recent Scans
      </p>
      {#key historyKey}
        <ScanHistory onview={viewHistoricalResult} />
      {/key}
    </div>
  {/if}
</div>
