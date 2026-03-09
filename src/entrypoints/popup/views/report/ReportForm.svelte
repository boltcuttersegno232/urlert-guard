<script lang="ts">
  import type { ExtensionScanResult } from "$lib/scan";
  import { Button } from "$lib/components/ui/button";
  import {
    Flag,
    SendHorizonal,
    ArrowLeft,
    AlertTriangle,
    Globe,
  } from "@lucide/svelte";

  interface Props {
    initialUrl: string;
    scanResult?: ExtensionScanResult | null;
    onclose: () => void;
    onsubmit: (editedUrl: string, content: string) => void;
    errorMsg?: string | null;
  }

  let {
    initialUrl,
    scanResult = null,
    onclose,
    onsubmit,
    errorMsg = null,
  }: Props = $props();

  let editableUrl = $state(initialUrl);
  let userComment = $state("");
  let consentChecked = $state(false);

  const canSubmit = $derived(
    consentChecked &&
      editableUrl.trim().length > 0 &&
      (userComment.trim().length > 0 || scanResult !== null),
  );

  const URLERT_DISCUSS_URL = import.meta.env.DEV
    ? "http://localhost:5175"
    : "https://discuss.urlert.com";

  function handleSubmit() {
    onsubmit(editableUrl, userComment);
  }
</script>

<!-- Back button -->
<button
  onclick={onclose}
  class="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-300 transition-colors w-fit cursor-pointer"
>
  <ArrowLeft class="w-3.5 h-3.5" />
  Back
</button>

<!-- Header -->
<div
  class="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15"
>
  <div
    class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0"
  >
    <Flag class="w-6 h-6 text-amber-400" />
  </div>
  <div class="min-w-0 flex-1">
    <p class="text-base font-semibold text-slate-200">Report URL</p>
    <p class="text-sm text-slate-400 mt-1 leading-relaxed">
      Submit a threat report. It will be posted to the <a
        href={URLERT_DISCUSS_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="text-amber-400/80 hover:text-amber-300 underline underline-offset-2"
        >URLert discussion pages</a
      >.
    </p>
  </div>
</div>

<!-- URL field -->
<div class="flex flex-col gap-1.5 px-0.5">
  <label
    for="report-url"
    class="text-xs font-semibold text-slate-400 uppercase tracking-wider"
    >URL</label
  >
  <div class="relative">
    <Globe
      class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600"
    />
    <input
      id="report-url"
      type="url"
      bind:value={editableUrl}
      class="w-full pl-8 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.06] transition-all"
      placeholder="https://example.com"
    />
  </div>
</div>

<!-- Scan context (if from scan) -->
{#if scanResult}
  <div class="flex flex-col gap-1.5 px-0.5">
    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
      Scan Data Included
    </p>
    <div
      class="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-slate-400 leading-relaxed"
    >
      <div class="flex items-center gap-2 mb-1.5">
        <span
          class="text-xs font-semibold px-1.5 py-0.5 rounded {scanResult.safety_level ===
          'safe'
            ? 'bg-emerald-500/15 text-emerald-400'
            : scanResult.safety_level === 'caution'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-red-500/15 text-red-400'}"
        >
          {scanResult.safety_level.toUpperCase()}
        </span>
      </div>
      <p class="line-clamp-2">{scanResult.summary}</p>
      {#if scanResult.risks && scanResult.risks.length > 0}
        <p class="mt-1 text-slate-400">
          + {scanResult.risks.length} risk{scanResult.risks.length > 1
            ? "s"
            : ""} identified
        </p>
      {/if}
    </div>
  </div>
{/if}

<!-- User comment -->
<div class="flex flex-col gap-1.5 px-0.5">
  <label
    for="report-comment"
    class="text-xs font-semibold text-slate-400 uppercase tracking-wider"
  >
    {scanResult ? "Additional Comments" : "Description"}
    {#if !scanResult}
      <span class="text-red-400">*</span>
    {/if}
  </label>
  <textarea
    id="report-comment"
    bind:value={userComment}
    rows="3"
    class="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.06] transition-all resize-none leading-relaxed"
    placeholder={scanResult
      ? "Add any additional details about why you believe this is a threat…"
      : "Describe why you believe this URL is malicious or suspicious…"}
  ></textarea>
</div>

<!-- Consent checkbox -->
<label
  for="report-consent"
  class="flex items-start gap-2.5 px-0.5 cursor-pointer group"
>
  <input
    id="report-consent"
    type="checkbox"
    bind:checked={consentChecked}
    class="mt-0.5 w-3.5 h-3.5 rounded border border-white/[0.15] bg-white/[0.04] accent-amber-500 cursor-pointer shrink-0"
  />
  <span
    class="text-[13px] text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors select-none"
  >
    I understand this report will be <strong class="text-amber-400/70"
      >publicly shared</strong
    > on URLert discussion pages.
  </span>
</label>

<!-- Error message -->
{#if errorMsg}
  <div
    class="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300 leading-relaxed"
  >
    <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
    {errorMsg}
  </div>
{/if}

<!-- Submit button -->
<Button
  size="sm"
  class="gap-2 bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 hover:text-amber-200 hover:border-amber-500/35 shadow-none h-11 text-sm font-semibold w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white/[0.03] disabled:text-slate-600 disabled:border-white/[0.06]"
  onclick={handleSubmit}
  disabled={!canSubmit}
>
  <SendHorizonal class="w-4 h-4" />
  Submit Report
</Button>
