<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { urlert } from "$lib/api";
  import type { DomainClassification } from "$lib/api";
  import { Spinner } from "$lib/components/ui/spinner";
  import { ScanSearch } from "@lucide/svelte";

  const SCAN_RETRY_DELAY_MS = 35_000;

  let {
    domain,
    onresolved,
  }: {
    domain: string;
    onresolved: (result: DomainClassification | null) => void;
  } = $props();

  let countdown = $state(Math.round(SCAN_RETRY_DELAY_MS / 1000));

  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  function clearTimers() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  onMount(() => {
    countdownInterval = setInterval(() => {
      countdown = Math.max(0, countdown - 1);
    }, 1000);

    retryTimer = setTimeout(async () => {
      clearTimers();
      const result = await urlert.forceRefreshClassification(domain);
      onresolved(result);
    }, SCAN_RETRY_DELAY_MS);
  });

  onDestroy(clearTimers);
</script>

<div
  class="flex flex-col items-center justify-center text-center gap-3 py-8 min-h-[140px]"
>
  <div
    class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center"
  >
    <ScanSearch class="w-6 h-6 text-indigo-400" />
  </div>
  <div class="space-y-1.5">
    <p class="text-[15px] font-bold text-slate-300">Scanning domain…</p>
    <p class="text-sm text-slate-400 leading-relaxed max-w-[320px]">
      <strong class="text-slate-300">{domain}</strong> is new to us. Our backend
      is analyzing it now.
    </p>
  </div>
  <div class="flex items-center gap-1.5 text-[13px] text-slate-500">
    <Spinner class="w-3.5 h-3.5 text-indigo-500/60" />
    {#if countdown > 0}
      Checking again in {countdown}s
    {:else}
      Checking…
    {/if}
  </div>
</div>
