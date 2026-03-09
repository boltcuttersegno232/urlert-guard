<script lang="ts">
  import { Switch } from "$lib/components/ui/switch";
  import { Label } from "$lib/components/ui/label";
  import SettingInfo from "./SettingInfo.svelte";

  let {
    id,
    label,
    description,
    checked,
    disabled = false,
    onchange,
  }: {
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    disabled?: boolean;
    onchange: (value: boolean) => void;
  } = $props();
</script>

<div
  class="flex items-center justify-between gap-3 py-2"
  class:opacity-40={disabled}
>
  <div class="flex items-center gap-1.5 flex-1 min-w-0">
    <Label for={id} class="cursor-pointer select-none">
      <span class="text-sm font-medium text-slate-200 block leading-snug"
        >{label}</span
      >
    </Label>
    {#if description}
      <SettingInfo content={description} />
    {/if}
  </div>
  <div class="shrink-0">
    <Switch {id} {checked} {disabled} onCheckedChange={onchange} />
  </div>
</div>
