<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { CircleX, X, SendHorizonal, CalendarClock } from "@lucide/svelte";

  interface Props {
    errorMsg: string | null;
    status?: number | null;
    ondismiss: () => void;
    onretry: () => void;
  }

  let { errorMsg, status, ondismiss, onretry }: Props = $props();

  const isLimitReached = $derived(status === 429);
  const title = $derived(
    isLimitReached ? "Daily limit reached" : "Scan failed",
  );
  const displayMessage = $derived(
    isLimitReached
      ? "You've reached your daily limit. Your scan allowance will automatically reset tomorrow."
      : (errorMsg ?? "Something went wrong. Please try again."),
  );
</script>

<div
  class="flex flex-col items-center text-center gap-4 py-8 animate-in fade-in zoom-in-95 duration-300"
>
  <div
    class="w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 {isLimitReached
      ? 'bg-amber-500/10 border border-amber-500/20'
      : 'bg-red-500/10 border border-red-500/20'}"
  >
    {#if isLimitReached}
      <CalendarClock class="w-7 h-7 text-amber-400" />
    {:else}
      <CircleX class="w-7 h-7 text-red-400" />
    {/if}
  </div>

  <div class="space-y-2">
    <p
      class="text-lg font-bold tracking-tight {isLimitReached
        ? 'text-amber-200'
        : 'text-red-300'}"
    >
      {title}
    </p>
    <p class="text-sm text-slate-400 leading-relaxed max-w-[280px] px-2">
      {displayMessage}
    </p>
  </div>

  <div class="flex gap-2.5 mt-2">
    <Button
      variant="ghost"
      size="sm"
      class="text-sm gap-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-400/10 h-10 px-5"
      onclick={ondismiss}
    >
      <X class="w-4 h-4" />
      Dismiss
    </Button>

    {#if !isLimitReached}
      <Button
        size="sm"
        class="text-sm gap-1.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/25 shadow-none h-10 px-5"
        onclick={onretry}
      >
        <SendHorizonal class="w-4 h-4" />
        Retry
      </Button>
    {/if}
  </div>
</div>
