<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    children,
  }: {
    title: string;
    children: Snippet;
  } = $props();
</script>

<div class="space-y-1.5">
  <h3
    class="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 px-0.5"
  >
    {title}
  </h3>
  <div
    class="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-0.5"
  >
    {@render children()}
  </div>
</div>
