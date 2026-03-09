<script lang="ts">
  import type { DomainClassification } from "$lib/api";
  import { Building2 } from "@lucide/svelte";

  let {
    classification,
  }: {
    classification: DomainClassification;
  } = $props();

  // Format purpose slug for display (e.g. "file_storage" → "File Storage")
  function formatPurpose(slug: string): string {
    return slug
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
</script>

<!-- Only show facts that add info not already in trust signals -->
{#if classification.category?.specialization || classification.facts?.hosting_provider}
  <div class="space-y-1.5 pt-1">
    {#if classification.category?.specialization}
      <div class="flex items-start justify-between gap-3 text-sm">
        <span class="text-slate-400 shrink-0 pt-0.5">Category</span>
        <span class="font-medium text-slate-300 text-right break-words"
          >{classification.category.specialization}</span
        >
      </div>
    {:else if classification.category?.purpose}
      <div class="flex items-start justify-between gap-3 text-xs">
        <span class="text-slate-400 shrink-0 pt-0.5">Category</span>
        <span class="font-medium text-slate-300 text-right break-words"
          >{formatPurpose(classification.category.purpose)}</span
        >
      </div>
    {/if}
    {#if classification.facts?.hosting_provider}
      <div class="flex items-start justify-between gap-3 text-sm">
        <span class="text-slate-400 flex items-center gap-1.5 shrink-0 pt-0.5"
          ><Building2 class="w-3.5 h-3.5" /> Hosting</span
        >
        <span class="font-medium text-slate-300 text-right break-words"
          >{classification.facts.hosting_provider}</span
        >
      </div>
    {/if}
  </div>
{/if}
