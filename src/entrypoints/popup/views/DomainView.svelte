<script lang="ts">
  import type { DomainClassification } from "$lib/api";
  import { buildOverlaySafetyContext } from "$lib/overlay-types";
  import SafetyStatus from "$lib/components/domain/SafetyStatus.svelte";
  import Identity from "$lib/components/domain/Identity.svelte";
  import RiskList from "$lib/components/domain/RiskList.svelte";
  import Facts from "$lib/components/domain/Facts.svelte";
  import UrlertNote from "$lib/components/domain/UrlertNote.svelte";
  import { ExternalLink } from "@lucide/svelte";

  let {
    classification,
    domain,
  }: {
    classification: DomainClassification;
    domain: string;
  } = $props();

  const ctx = $derived(buildOverlaySafetyContext(classification));
</script>

<div
  class="flex flex-col gap-0 animate-in fade-in slide-in-from-bottom-1 duration-250"
>
  <!-- 1. Bottom line: badge + verdict + trust evidence -->
  <section class="py-0.5">
    <SafetyStatus safetyCtx={ctx} />
  </section>

  <!-- 1b. Admin note (shown when present) -->
  {#if classification.admin_note}
    <div class="h-px bg-white/5 my-3"></div>
    <section class="py-0.5">
      <UrlertNote {classification} safetyCtx={ctx} />
    </section>
  {/if}

  <!-- 2. Risks (compact, expandable) -->
  {#if ctx.risks.length > 0}
    <div class="h-px bg-white/5 my-3"></div>
    <section class="py-0.5">
      <RiskList safetyCtx={ctx} />
    </section>
  {/if}

  <!-- 3. Who is this site? -->
  {#if classification.identity?.headline || classification.identity?.summary}
    <div class="h-px bg-white/5 my-3"></div>
    <section class="py-0.5">
      <Identity {classification} />
    </section>
  {/if}

  <!-- 4. Quick facts -->
  <div class="h-px bg-white/5 my-3"></div>
  <section class="py-0.5">
    <Facts {classification} />
  </section>

  <!-- CTA -->
  <div class="mt-3.5 pt-3.5 border-t border-white/5">
    <a
      class="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg text-sm font-semibold text-indigo-400 bg-indigo-500/8 border border-indigo-500/15 hover:bg-indigo-500/14 hover:text-indigo-300 hover:border-indigo-500/25 transition-all group"
      href="https://www.urlert.com/domains/{domain}"
      target="_blank"
      rel="noopener noreferrer"
    >
      Full Analysis on URLert
      <ExternalLink
        class="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
      />
    </a>
  </div>
</div>
