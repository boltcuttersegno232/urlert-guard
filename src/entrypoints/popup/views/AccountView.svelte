<script lang="ts">
  import type { AuthState } from "$lib/auth";
  import { Button } from "$lib/components/ui/button";
  import SettingSection from "$lib/components/settings/SettingSection.svelte";
  import SubscriptionStatus from "$lib/components/settings/SubscriptionStatus.svelte";
  import { LogIn, LogOut, User, Scan } from "@lucide/svelte";

  interface Props {
    authState: AuthState | null;
    authLoading: boolean;
    openSignIn: () => void;
    signOut: () => void;
  }

  let { authState, authLoading, openSignIn, signOut }: Props = $props();

  let subscription = $state(null);
  let subLoading = $state(false);
</script>

<div class="space-y-4 animate-in fade-in duration-200">
  {#if authLoading}
    <div class="flex items-center justify-center py-10">
      <div
        class="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"
      ></div>
    </div>
  {:else if authState}
    <!-- Profile section -->
    <SettingSection title="Profile">
      <div class="flex items-center justify-between gap-3 py-2">
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-8 h-8 rounded-lg bg-indigo-500/12 border border-indigo-500/20 flex items-center justify-center shrink-0"
          >
            <User class="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-200 truncate">
              {authState.email}
            </p>
            <p
              class="text-[13px] text-emerald-400/80 mt-0.5 flex items-center gap-1"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
              ></span>
              Connected
            </p>
          </div>
        </div>
      </div>
    </SettingSection>

    <!-- Subscription section -->
    <SettingSection title="Subscription">
      <SubscriptionStatus bind:subscription bind:loading={subLoading} />
    </SettingSection>

    <!-- Features section -->
    <SettingSection title="Features">
      <div class="flex items-start gap-2.5 py-2.5">
        <Scan class="w-4 h-4 text-indigo-400/70 mt-0.5 shrink-0" />
        <div>
          <p class="text-sm font-medium text-slate-300">
            On-demand URL scanning
          </p>
          <p class="text-[13px] text-slate-400 mt-1 leading-relaxed">
            Scan any page for threats using the <strong class="text-slate-300"
              >Scan</strong
            > tab in the popup. A screenshot and page content are sent to URLert
            for AI analysis.
          </p>
        </div>
      </div>
    </SettingSection>

    <!-- Actions -->
    <div class="flex items-center pt-1">
      <Button
        variant="ghost"
        size="sm"
        class="text-sm gap-1.5 text-slate-400 hover:text-slate-300 px-2 h-8"
        onclick={signOut}
      >
        <LogOut class="w-3.5 h-3.5" /> Sign out
      </Button>
    </div>
  {:else}
    <!-- Signed out -->
    <SettingSection title="Account">
      <div class="flex items-center justify-between gap-4 py-2.5">
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-8 h-8 rounded-lg bg-indigo-500/12 border border-indigo-500/20 flex items-center justify-center shrink-0"
          >
            <User class="w-3.5 h-3.5 text-indigo-400/80" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-200">Sign in to URLert</p>
            <p class="text-[13px] text-slate-400 mt-0.5 leading-relaxed">
              Unlock URL scanning and more features
            </p>
          </div>
        </div>
        <Button
          size="sm"
          class="gap-1.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/25 hover:text-indigo-200 hover:border-indigo-500/35 shadow-none h-9 px-4 text-sm font-semibold shrink-0"
          onclick={openSignIn}
        >
          <LogIn class="w-4 h-4" />
          Sign in
        </Button>
      </div>
    </SettingSection>

    <p class="text-[13px] text-slate-500 leading-relaxed px-0.5">
      You'll be taken to urlert.com to sign in securely. The extension never
      handles your password.
    </p>
  {/if}
</div>
