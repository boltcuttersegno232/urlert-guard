<script lang="ts">
  import { onMount } from "svelte";
  import type { ScanHistoryItem } from "$lib/scan";
  import { cn } from "$lib/utils";
  import { Button } from "$lib/components/ui/button";
  import {
    History,
    Trash2,
    ShieldCheck,
    ShieldAlert,
    TriangleAlert,
  } from "@lucide/svelte";

  interface Props {
    /** Called when user wants to view details of a past scan result. */
    onview?: (item: ScanHistoryItem) => void;
  }

  let { onview }: Props = $props();

  let history = $state<ScanHistoryItem[]>([]);
  let loaded = $state(false);

  onMount(async () => {
    const items: ScanHistoryItem[] = await browser.runtime.sendMessage({
      type: "URLERT_GET_SCAN_HISTORY",
    });
    history = items ?? [];
    loaded = true;
  });

  async function clearHistory() {
    await browser.runtime.sendMessage({ type: "URLERT_CLEAR_SCAN_HISTORY" });
    history = [];
  }

  function levelColor(level: string) {
    return level === "safe"
      ? "text-emerald-400"
      : level === "caution"
        ? "text-amber-400"
        : "text-red-400";
  }

  function levelBg(level: string) {
    return level === "safe"
      ? "bg-emerald-500/10 border-emerald-500/20"
      : level === "caution"
        ? "bg-amber-500/10 border-amber-500/20"
        : "bg-red-500/10 border-red-500/20";
  }

  function levelLabel(level: string) {
    return level === "safe"
      ? "Safe"
      : level === "caution"
        ? "Caution"
        : "Danger";
  }

  function relativeTime(iso: string): string {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60_000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return "";
    }
  }
</script>

{#if !loaded}
  <!-- skeleton -->
  <div class="space-y-2">
    {#each [1, 2] as _}
      <div
        class="h-14 rounded-xl bg-white/[0.03] border border-white/[0.05] animate-pulse"
      ></div>
    {/each}
  </div>
{:else if history.length === 0}
  <div
    class="flex flex-col items-center justify-center gap-2.5 py-6 text-center"
  >
    <div
      class="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
    >
      <History class="w-5 h-5 text-slate-500" />
    </div>
    <p class="text-sm text-slate-500">No scan history yet.</p>
  </div>
{:else}
  <div class="flex flex-col gap-1.5">
    {#each history as item (item.job_id)}
      <button
        class="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.09] transition-all text-left w-full cursor-pointer"
        onclick={() => onview?.(item)}
        title="View result"
      >
        <!-- Icon -->
        <div
          class={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            levelBg(item.result.safety_level),
          )}
        >
          {#if item.result.safety_level === "safe"}
            <ShieldCheck
              class={cn("w-4 h-4", levelColor(item.result.safety_level))}
            />
          {:else if item.result.safety_level === "caution"}
            <TriangleAlert
              class={cn("w-4 h-4", levelColor(item.result.safety_level))}
            />
          {:else}
            <ShieldAlert
              class={cn("w-4 h-4", levelColor(item.result.safety_level))}
            />
          {/if}
        </div>

        <!-- Domain + snippet -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-semibold text-slate-300 truncate"
              >{item.domain}</span
            >
            <span
              class={cn(
                "text-xs font-semibold shrink-0",
                levelColor(item.result.safety_level),
              )}
            >
              {levelLabel(item.result.safety_level)}
            </span>
          </div>
          <p
            class="text-[13px] text-slate-500 leading-snug line-clamp-1 mt-0.5"
          >
            {item.result.summary}
          </p>
        </div>

        <!-- Time -->
        <span class="text-xs text-slate-500 shrink-0"
          >{relativeTime(item.scanned_at)}</span
        >
      </button>
    {/each}

    <Button
      variant="ghost"
      size="sm"
      class="text-[13px] gap-2 text-slate-500 hover:text-red-400 h-8 w-full mt-1"
      onclick={clearHistory}
    >
      <Trash2 class="w-3.5 h-3.5" />
      Clear history
    </Button>
  </div>
{/if}
