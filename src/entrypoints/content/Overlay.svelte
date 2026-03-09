<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { ThreatLevel } from "$lib/overlay-types";
  import type { OverlaySettings } from "$lib/settings";
  import OverlayIcon from "./OverlayIcon.svelte";

  let {
    threatLevel,
    settings,
  }: {
    threatLevel: ThreatLevel;
    settings: OverlaySettings;
  } = $props();

  let visible = $state(true);
  let hovered = $state(false);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleDismiss() {
    clearDismissTimer();
    if (settings.autoDismissSeconds > 0 && !hovered) {
      dismissTimer = setTimeout(() => {
        visible = false;
      }, settings.autoDismissSeconds * 1000);
    }
  }

  function clearDismissTimer() {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function handleMouseEnter() {
    hovered = true;
    clearDismissTimer();
  }
  function handleMouseLeave() {
    hovered = false;
    scheduleDismiss();
  }

  function handleIconClick() {
    // Send message to background script to open the extension popup.
    // The popup already fetches and displays domain classification data.
    browser.runtime.sendMessage({ type: "URLERT_OPEN_POPUP" }).catch(() => {
      // Fallback: if openPopup() isn't supported, the user can still
      // click the extension toolbar icon manually.
      console.log("URLert: popup open not supported, use toolbar icon");
    });
  }

  onMount(scheduleDismiss);
  onDestroy(clearDismissTimer);
</script>

{#if visible}
  <div
    role="complementary"
    aria-label="URLert Guard security indicator"
    class="host"
    class:pos-top-right={settings.position === "top-right"}
    class:pos-top-left={settings.position === "top-left"}
    class:pos-bottom-right={settings.position === "bottom-right"}
    class:pos-bottom-left={settings.position === "bottom-left"}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
  >
    <OverlayIcon {threatLevel} onclick={handleIconClick} />
  </div>
{/if}

<style>
  .host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    color-scheme: light dark;
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
  }

  .pos-top-right {
    top: 20px;
    right: 20px;
  }
  .pos-top-left {
    top: 20px;
    left: 20px;
  }
  .pos-bottom-right {
    bottom: 20px;
    right: 20px;
  }
  .pos-bottom-left {
    bottom: 20px;
    left: 20px;
  }
</style>
