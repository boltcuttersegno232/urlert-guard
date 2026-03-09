<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Info } from "@lucide/svelte";

  let { content }: { content: string } = $props();
</script>

<Tooltip.Provider delayDuration={200}>
  <Tooltip.Root>
    <Tooltip.Trigger
      class="text-slate-500 hover:text-slate-300 transition-colors p-1"
    >
      <Info class="w-4 h-4" />
      <span class="sr-only">Information</span>
    </Tooltip.Trigger>
    <Tooltip.Content
      class="bg-[#1a1d2e] border-white/[0.08] text-slate-200 text-[13px] max-w-[320px] leading-relaxed px-3.5 py-2.5"
      arrowClasses="hidden"
      side="top"
      align="center"
    >
      {content}
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
