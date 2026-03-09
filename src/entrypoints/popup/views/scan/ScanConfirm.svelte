<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import {
    ScanSearch,
    MonitorSmartphone,
    Code,
    SendHorizonal,
    Lock,
    ShieldAlert,
  } from "@lucide/svelte";

  interface Props {
    domain: string;
    onsubmit: () => void;
    disabled?: boolean;
  }

  let { domain, onsubmit, disabled = false }: Props = $props();
</script>

<div class="flex flex-col gap-4">
  <!-- Header card -->
  <div
    class="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
  >
    <div
      class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0"
    >
      <ScanSearch class="w-6 h-6 text-indigo-400" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-base font-semibold text-slate-200">Scan this page</p>
      <p class="text-sm text-slate-400 mt-1.5 leading-relaxed">
        Send <strong class="text-slate-300">{domain}</strong> to URLert for AI-powered
        threat analysis.
      </p>
    </div>
  </div>

  <!-- What will be sent -->
  <div class="flex flex-col gap-3 px-1">
    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
      What will be sent
    </p>
    <div class="flex items-center gap-3 text-sm text-slate-400">
      <div
        class="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0"
      >
        <MonitorSmartphone class="w-4 h-4 text-slate-500" />
      </div>
      <span>Screenshot of the visible page</span>
    </div>
    <div class="flex items-center gap-3 text-sm text-slate-400">
      <div
        class="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0"
      >
        <Code class="w-4 h-4 text-slate-500" />
      </div>
      <span>Page HTML content</span>
    </div>
  </div>

  <!-- Privacy note -->
  <div class="flex flex-col gap-2.5 px-1">
    <div class="flex items-start gap-2.5">
      <Lock class="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
      <p class="text-xs text-slate-500 leading-relaxed">
        Sent securely to URLert for threat analysis only. Nothing is sent without
        your explicit request.
      </p>
    </div>
    <div
      class="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/15"
    >
      <ShieldAlert class="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <p class="text-xs text-amber-300/90 leading-relaxed">
        Avoid scanning pages that contain personal or sensitive information
        (e.g.&nbsp;banking, email, medical portals).
      </p>
    </div>
  </div>

  <Button
    size="sm"
    class="gap-2 bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/25 hover:text-indigo-200 hover:border-indigo-500/35 shadow-none h-11 text-sm font-semibold w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700"
    onclick={onsubmit}
    {disabled}
  >
    <SendHorizonal class="w-4 h-4" />
    {disabled ? "Verification Required" : "Send for Analysis"}
  </Button>
</div>
