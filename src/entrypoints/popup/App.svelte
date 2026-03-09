<script lang="ts">
  import { onMount } from "svelte";
  import { urlert } from "$lib/api";
  import type { DomainClassification } from "$lib/api";
  import type { AuthState } from "$lib/auth";
  import { getShortcutFor } from "$lib/shortcuts";

  import * as Kbd from "$lib/components/ui/kbd";

  import * as Tabs from "$lib/components/ui/tabs";
  import {
    Globe,
    CircleAlert,
    Settings,
    Shield,
    ExternalLink,
    LogIn,
    ScanSearch,
    Flag,
    HelpCircle,
  } from "@lucide/svelte";
  import { Spinner } from "$lib/components/ui/spinner";

  import DomainView from "./views/DomainView.svelte";
  import ScanningView from "./views/ScanningView.svelte";
  import ScanRequestView from "./views/ScanRequestView.svelte";
  import ReportView from "./views/ReportView.svelte";

  const AUTH_URL = import.meta.env.DEV
    ? "http://localhost:5173/extension/auth"
    : "https://www.urlert.com/extension/auth";

  let classification = $state<DomainClassification | null>(null);
  let loading = $state(true);
  let scanning = $state(false);
  let currentDomain = $state("");
  let currentUrl = $state("");
  let currentTabId = $state(0);
  let isHttpPage = $state(false);
  let cachedScreenshot = $state<string | null>(null);

  // Auth state — lifted here so header can show login indicator
  let authState = $state<AuthState | null>(null);
  let authLoading = $state(true);

  onMount(async () => {
    let intentSet = false;
    // 1. Check for launch intent (e_g_, from a keyboard shortcut or notification click)
    try {
      const data = await browser.storage.local.get([
        "urlertLaunchIntent",
        "urlertLaunchJobId",
      ]);
      if (data.urlertLaunchIntent) {
        activeTab = data.urlertLaunchIntent as string;
        intentSet = true;
        await browser.storage.local.remove("urlertLaunchIntent");
      }
      if (data.urlertLaunchJobId) {
        focusJobId = data.urlertLaunchJobId as string;
        await browser.storage.local.remove("urlertLaunchJobId");
      }
    } catch {}

    // 2. Fetch domain classification and current tab info
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.url) {
        const url = new URL(tab.url);
        if (url.protocol.startsWith("http")) {
          isHttpPage = true;
          currentDomain = url.hostname;
          currentUrl = tab.url!;
          currentTabId = tab.id!;

          // Capture a screenshot immediately while activeTab is still fresh
          // from the user's icon click. Stored in popup memory so it survives
          // the MV3 service worker going idle.
          try {
            cachedScreenshot = await browser.tabs.captureVisibleTab({
              format: "jpeg",
              quality: 70,
            });
          } catch {
            // activeTab not available (e.g. restricted page) — scan will proceed without screenshot
          }

          classification = await urlert.classifyDomain(currentDomain);
          if (classification === null) scanning = true;
        }
      }
    } catch (e) {
      console.error("Popup error:", e);
    } finally {
      loading = false;
    }

    // 3. Auto-switch to Scan tab if there is an active/completed scan waiting for THIS domain
    // Skip if an explicit intent was already set (e_g_ clicking the overlay icon sets 'domain' intent)
    if (!intentSet && currentDomain) {
      try {
        const activeScan = await browser.runtime.sendMessage({
          type: "URLERT_GET_ACTIVE_SCAN",
        });
        if (
          activeScan &&
          activeScan.domain === currentDomain &&
          activeTab !== "scan"
        ) {
          activeTab = "scan";
        }
      } catch {}
    }

    // 4. Fetch auth state
    try {
      authState = await browser.runtime.sendMessage({ type: "GET_AUTH_STATE" });
    } catch {
      authState = null;
    } finally {
      authLoading = false;
    }

    // 5. Load keyboard shortcut for footer display
    openShortcut = await getShortcutFor("_execute_action");
  });

  // Listen for auth state changes (e.g. login happening in background)
  browser.storage.onChanged.addListener((changes) => {
    if (changes.urlertAuth) {
      authState = (changes.urlertAuth.newValue as AuthState) ?? null;
    }
    // Handle launch intent from keyboard shortcut while popup is already open
    if (changes.urlertLaunchIntent?.newValue) {
      activeTab = changes.urlertLaunchIntent.newValue as string;
      browser.storage.local.remove("urlertLaunchIntent");
    }
    if (changes.urlertLaunchJobId?.newValue) {
      focusJobId = changes.urlertLaunchJobId.newValue as string;
      browser.storage.local.remove("urlertLaunchJobId");
    }
  });

  function openSignIn() {
    browser.tabs.create({ url: AUTH_URL });
  }

  function handleScanResolved(result: DomainClassification | null) {
    classification = result;
    scanning = false;
  }

  // Active tab — controlled state
  let activeTab = $state("domain");
  let openShortcut = $state<string[]>([]);
  let focusJobId = $state<string | null>(null);

  // Report overlay — shown on top of normal tab content
  let showReport = $state(false);
</script>

<main
  class="w-[520px] min-h-[300px] max-h-[650px] flex flex-col bg-[#0a0c14] text-slate-200 antialiased overflow-hidden"
>
  <!-- Header -->
  <header
    class="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent shrink-0"
  >
    <div class="flex items-center gap-2.5 min-w-0">
      <img
        src="/logo_dark_small.webp"
        alt="URLert Guard"
        class="h-7 object-contain shrink-0"
      />
      {#if currentDomain}
        <span
          class="text-[13px] text-slate-400 font-medium truncate max-w-[260px]"
          >{currentDomain}</span
        >
      {/if}
    </div>
    <div class="flex items-center gap-2 shrink-0">
      {#if isHttpPage}
        <button
          onclick={() => (showReport = true)}
          class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-amber-500/80 transition-all cursor-pointer"
          title="Report URL"
        >
          <Flag class="w-4 h-4" />
        </button>
      {/if}
      <a
        href="https://www.urlert.com/extension"
        target="_blank"
        rel="noopener noreferrer"
        class="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.08] hover:border-white/[0.10] transition-all cursor-pointer"
        title="Help & Support"
      >
        <HelpCircle class="w-4 h-4" />
      </a>
      <!-- Settings gear -->
      <button
        onclick={() => browser.runtime.openOptionsPage()}
        class="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.08] hover:border-white/[0.10] transition-all cursor-pointer"
        title="Settings"
      >
        <Settings class="w-4 h-4" />
      </button>
      {#if authLoading}
        <div
          class="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
        >
          <Spinner class="w-3.5 h-3.5 text-slate-500" />
        </div>
      {:else if authState}
        <!-- Logged-in: green status dot on settings gear is sufficient -->
      {:else}
        <!-- Logged-out: sign in button -->
        <button
          onclick={openSignIn}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-slate-300 hover:border-white/[0.12] transition-all cursor-pointer"
        >
          <LogIn class="w-3.5 h-3.5" />
          Sign in
        </button>
      {/if}
    </div>
  </header>

  <!-- Tabs (hidden when report overlay is active) -->
  {#if !showReport}
    <Tabs.Root
      bind:value={activeTab}
      class="flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      <div
        class="px-4 py-2.5 border-b border-white/[0.06] shrink-0 bg-white/[0.01]"
      >
        <Tabs.List
          class="bg-white/[0.04] p-1 rounded-xl w-full flex border-none"
        >
          <Tabs.Trigger
            value="domain"
            class="flex-1 text-[13px] font-semibold py-2 px-3 gap-2 text-slate-500 rounded-lg border-none bg-transparent
                 data-[state=active]:text-indigo-300 data-[state=active]:bg-indigo-500/10 data-[state=active]:shadow-sm
                 hover:text-slate-300 transition-all duration-200"
          >
            <Shield class="w-4 h-4" />
            Security
          </Tabs.Trigger>
          <Tabs.Trigger
            value="scan"
            class="flex-1 text-[13px] font-semibold py-2 px-3 gap-2 text-slate-500 rounded-lg border-none bg-transparent
                 data-[state=active]:text-indigo-300 data-[state=active]:bg-indigo-500/10 data-[state=active]:shadow-sm
                 hover:text-slate-300 transition-all duration-200"
          >
            <ScanSearch class="w-4 h-4" />
            Scan
          </Tabs.Trigger>
        </Tabs.List>
      </div>

      <!-- Domain / Security tab -->
      <Tabs.Content
        value="domain"
        class="flex-1 overflow-y-auto overflow-x-hidden p-5 scrollbar-thin scrollbar-thumb-white/8 scrollbar-track-transparent"
      >
        {#if loading}
          <div
            class="flex flex-col items-center justify-center text-center gap-2.5 py-8 min-h-[140px]"
          >
            <Spinner class="w-7 h-7 text-indigo-400" />
            <p class="text-sm text-slate-400 font-medium">
              Analyzing current page…
            </p>
          </div>
        {:else if !isHttpPage}
          <div
            class="flex flex-col items-center justify-center text-center gap-2.5 py-8 min-h-[140px]"
          >
            <div
              class="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            >
              <Globe class="w-6 h-6 text-slate-600" />
            </div>
            <p class="text-[15px] font-bold text-slate-400">Not a web page</p>
            <p class="text-sm text-slate-400 leading-relaxed max-w-[320px]">
              Navigate to an http/https website to see domain security insights.
            </p>
          </div>
        {:else if classification}
          <DomainView {classification} domain={currentDomain} />
        {:else if scanning}
          <ScanningView
            domain={currentDomain}
            onresolved={handleScanResolved}
          />
        {:else}
          <div
            class="flex flex-col items-center justify-center text-center gap-2.5 py-8 min-h-[140px]"
          >
            <div
              class="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            >
              <CircleAlert class="w-6 h-6 text-slate-600" />
            </div>
            <p class="text-[15px] font-bold text-slate-400">
              No data available
            </p>
            <p class="text-sm text-slate-400 leading-relaxed max-w-[320px]">
              We don't have classification data for <strong
                class="text-slate-300">{currentDomain}</strong
              > yet. Try again later.
            </p>
          </div>
        {/if}
      </Tabs.Content>

      <!-- Scan tab -->
      <Tabs.Content
        value="scan"
        class="flex-1 overflow-y-auto overflow-x-hidden p-5"
      >
        {#if isHttpPage}
          <ScanRequestView
            url={currentUrl}
            domain={currentDomain}
            tabId={currentTabId}
            screenshot={cachedScreenshot}
            {authState}
            {openSignIn}
            {focusJobId}
            onFocusConsumed={() => (focusJobId = null)}
          />
        {:else}
          <div
            class="flex flex-col items-center justify-center text-center gap-3 py-8 min-h-[140px]"
          >
            <div
              class="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            >
              <Globe class="w-6 h-6 text-slate-600" />
            </div>
            <p class="text-[15px] font-bold text-slate-400">Not a web page</p>
            <p class="text-sm text-slate-500 leading-relaxed max-w-[320px]">
              Navigate to an http/https website to scan it.
            </p>
          </div>
        {/if}
      </Tabs.Content>
    </Tabs.Root>
  {:else}
    <!-- Report overlay — replaces tab content when active -->
    <div
      class="flex-1 overflow-y-auto overflow-x-hidden p-5 scrollbar-thin scrollbar-thumb-white/8 scrollbar-track-transparent"
    >
      <ReportView url={currentUrl} onclose={() => (showReport = false)} />
    </div>
  {/if}

  <!-- Footer -->
  <footer class="px-5 py-2.5 border-t border-white/[0.04] shrink-0">
    <div class="flex items-center justify-between">
      <a
        href="https://www.urlert.com"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-200 transition-colors font-medium"
      >
        <img src="/favicon.png" alt="" class="w-3.5 h-3.5 rounded-sm" />
        urlert.com
        <ExternalLink class="w-3 h-3" />
      </a>
      {#if openShortcut.length > 0}
        <Kbd.Group class="gap-0.5" title="Open URLert Guard">
          {#each openShortcut as key, i}
            {#if i > 0}<span class="text-xs text-slate-500">+</span>{/if}
            <Kbd.Root class="text-xs font-medium h-5 min-w-5 px-1.5"
              >{key}</Kbd.Root
            >
          {/each}
        </Kbd.Group>
      {/if}
    </div>
  </footer>
</main>
