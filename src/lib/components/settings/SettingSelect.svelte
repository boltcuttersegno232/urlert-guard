<script lang="ts">
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import SettingInfo from "./SettingInfo.svelte";

  let {
    label,
    description,
    value = $bindable(),
    disabled = false,
    options,
    onchange,
  }: {
    label: string;
    description?: string;
    value: string;
    disabled?: boolean;
    options: Array<{ value: string; label: string }>;
    onchange: (value: string) => void;
  } = $props();

  const displayLabel = $derived(
    options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "",
  );
</script>

<div class="py-2.5" class:opacity-40={disabled}>
  <div class="flex items-center gap-1.5 mb-2">
    <Label class="text-sm font-medium text-slate-200 block leading-snug"
      >{label}</Label
    >
    {#if description}
      <SettingInfo content={description} />
    {/if}
  </div>

  <Select.Root type="single" {disabled} bind:value onValueChange={onchange}>
    <Select.Trigger
      class="w-full h-9 text-sm bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06] text-slate-300"
    >
      {displayLabel}
    </Select.Trigger>
    <Select.Content class="bg-[#12141e] border-white/[0.08]">
      {#each options as opt (opt.value)}
        <Select.Item
          value={opt.value}
          label={opt.label}
          class="text-sm text-slate-300 focus:bg-white/[0.06] focus:text-slate-100"
        >
          {opt.label}
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</div>
