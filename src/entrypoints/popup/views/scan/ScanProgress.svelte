<script lang="ts">
  import { Spinner } from "$lib/components/ui/spinner";
  import { Radar } from "@lucide/svelte";

  interface Props {
    phase: "submitting" | "polling";
    domain: string;
    elapsedSeconds: number;
  }

  let { phase, domain, elapsedSeconds }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center text-center gap-4 py-6">
  <div
    class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center"
  >
    {#if phase === "submitting"}
      <Spinner class="w-6 h-6 text-indigo-400" />
    {:else}
      <Radar class="w-6 h-6 text-indigo-400" />
    {/if}
  </div>
  <div class="space-y-1.5">
    {#if phase === "submitting"}
      <p class="text-base font-bold text-slate-300">Capturing page…</p>
      <p class="text-sm text-slate-500 leading-relaxed max-w-[320px]">
        Taking a screenshot and collecting page data.
      </p>
    {:else}
      <p class="text-base font-bold text-slate-300">Analyzing…</p>
      <p class="text-sm text-slate-500 leading-relaxed max-w-[320px]">
        URLert AI is analyzing <strong class="text-slate-300">{domain}</strong>.
        This may take a moment.
      </p>
    {/if}
  </div>
  {#if phase === "polling"}
    <div class="flex items-center gap-2 text-sm text-slate-500">
      <Spinner class="w-3.5 h-3.5 text-indigo-500/60" />
      {elapsedSeconds}s elapsed
    </div>
  {/if}
</div>
