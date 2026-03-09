<script lang="ts">
  import { urlert } from "$lib/api";
  import type { ExtensionReportResponse } from "$lib/api";
  import type { ExtensionScanResult } from "$lib/scan";
  import { Spinner } from "$lib/components/ui/spinner";

  import ReportForm from "./report/ReportForm.svelte";
  import ReportSuccess from "./report/ReportSuccess.svelte";

  interface Props {
    url: string;
    /** Pre-filled scan result (when reporting from scan) */
    scanResult?: ExtensionScanResult | null;
    /** Close / go back */
    onclose: () => void;
  }

  let { url, scanResult = null, onclose }: Props = $props();

  // ── State ───────────────────────────────────────────────────────────────────
  type ReportPhase = "form" | "submitting" | "success" | "error";
  let phase = $state<ReportPhase>("form");
  let errorMsg = $state<string | null>(null);
  let reportResponse = $state<ExtensionReportResponse | null>(null);

  // ── Build markdown content from scan + user comment ─────────────────────────

  function buildContent(
    userComment: string,
    scan: ExtensionScanResult | null,
  ): string {
    const parts: string[] = [];

    if (scan) {
      parts.push("## Scan Results\n");

      const levelEmoji =
        scan.safety_level === "safe"
          ? "✅"
          : scan.safety_level === "caution"
            ? "⚠️"
            : "🚨";
      parts.push(
        `**Safety Level:** ${levelEmoji} ${scan.safety_level.charAt(0).toUpperCase() + scan.safety_level.slice(1)}`,
      );

      if (scan.summary) {
        parts.push(`\n**Summary:** ${scan.summary}`);
      }
      if (scan.brand_warning) {
        parts.push(`\n**Brand Warning:** ${scan.brand_warning}`);
      }
      if (scan.risks && scan.risks.length > 0) {
        parts.push(`\n**Risks:**`);
        for (const risk of scan.risks) parts.push(`- ${risk}`);
      }
      if (scan.tips && scan.tips.length > 0) {
        parts.push(`\n**Tips:**`);
        for (const tip of scan.tips) parts.push(`- ${tip}`);
      }
      if (scan.domain_registered_date) {
        parts.push(`\n**Domain Registered:** ${scan.domain_registered_date}`);
      }
    }

    if (userComment.trim()) {
      if (scan) {
        parts.push("\n---\n");
        parts.push("## User Comment\n");
      }
      parts.push(userComment.trim());
    }

    return parts.join("\n");
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(editedUrl: string, userComment: string) {
    const content = buildContent(userComment, scanResult);
    if (!content.trim()) return;

    phase = "submitting";
    errorMsg = null;

    try {
      reportResponse = await urlert.submitReport({ url: editedUrl, content });
      phase = "success";
    } catch (err: any) {
      errorMsg = err?.message ?? "Failed to submit report";
      phase = "error";
    }
  }
</script>

<div
  class="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-1 duration-250"
>
  {#if phase === "form" || phase === "error"}
    <ReportForm
      initialUrl={url}
      {scanResult}
      {onclose}
      onsubmit={handleSubmit}
      errorMsg={phase === "error" ? errorMsg : null}
    />
  {:else if phase === "submitting"}
    <div
      class="flex flex-col items-center justify-center text-center gap-3 py-10"
    >
      <Spinner class="w-7 h-7 text-amber-400" />
      <p class="text-sm text-slate-400 font-medium">Submitting report…</p>
    </div>
  {:else if phase === "success"}
    <ReportSuccess response={reportResponse} {onclose} />
  {/if}
</div>
