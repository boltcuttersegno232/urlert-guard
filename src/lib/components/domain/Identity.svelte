<script lang="ts">
  import type { DomainClassification } from "$lib/api";

  let {
    classification,
  }: {
    classification: DomainClassification;
  } = $props();
</script>

<div class="space-y-1.5">
  {#if classification.identity?.headline}
    <h3 class="text-base font-bold text-slate-100 leading-snug">
      {classification.identity.headline}
    </h3>
  {/if}
  {#if classification.identity?.summary}
    <p class="text-sm text-slate-400 leading-relaxed">
      {classification.identity.summary}
    </p>
  {/if}
</div>
