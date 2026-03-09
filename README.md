# 🛡️ URLert Guard (Source-Available)

Real-time protection from risky and malicious domains. URLert Guard uses proprietary threat intelligence to keep you safe.

This repository contains the client-side source code for the URLert Guard extension.

### Why is this public?
We believe in "Transparency over Obscurity." We make our code visible so security researchers and users can verify our privacy claims and audit data handling.

**License:** Source-available for inspection only. See [LICENSE](LICENSE).

## Building from Source

Prerequisites: [Node.js](https://nodejs.org/) (v18+) and npm.

```bash
npm install        # install dependencies
npx wxt            # dev mode with hot reload (Chromium)
npx wxt build      # production build → .output/chrome-mv3/
```

Firefox:

```bash
npx wxt -b firefox          # dev mode
npx wxt build -b firefox    # production build
```

## Security Audit Guide

This repository is source-available so that security researchers, reviewers, and users can inspect exactly what the extension does. Below is a guided walkthrough of the security-relevant code.

### Permissions

Declared in [`wxt.config.ts`](wxt.config.ts):

| Permission | Why |
|---|---|
| `tabs` | Read the active tab's URL to classify the domain and send scan requests. |
| `storage` | Persist auth tokens, settings, scan history, and the domain classification cache. |
| `activeTab` | Capture a screenshot of the visible tab when the user explicitly requests a scan. |
| `host_permissions: *://api.urlert.com/*` | All network requests go exclusively to the URLert API. No other external hosts are contacted. |

### Network Requests

All API calls are in [`src/lib/api.ts`](src/lib/api.ts). Every request goes to `https://api.urlert.com/extensions/*` (or `localhost` in dev). The endpoints used:

| Endpoint | Auth required | Purpose |
|---|---|---|
| `GET /extensions/domain-classification/{domain}` | No | Classify a domain on navigation |
| `POST /extensions/scan` | Yes | Submit an on-demand scan (screenshot + HTML) |
| `GET /extensions/scan/{job_id}` | Yes | Poll scan job status |
| `POST /extensions/report` | No | Submit a URL threat report |
| `GET /extensions/subscription` | Yes | Fetch the user's subscription tier |
| `GET /extensions/auth/me` | Yes | Verify the current auth token |

**Domain privacy:** Domains are normalized to their registered domain (eTLD+1) before being sent to the API — for example, `mail.example.com` is sent as `example.com`. Subdomains are never leaked to the server. See the `getDomain()` call in [`src/lib/api.ts`](src/lib/api.ts).

**No data is sent to any third-party service.** The generated API types in [`src/lib/types/api.generated.ts`](src/lib/types/api.generated.ts) are filtered to only these endpoints — no other backend schemas are included.

### Authentication

Authentication flow overview:

1. User clicks "Sign in" → opens `urlert.com/extension/auth` in a new tab.
2. After login, the page sends a `window.postMessage` with an opaque token.
3. The [`auth-listener`](src/entrypoints/auth-listener.content.ts) content script (runs only on `urlert.com`) validates the message origin against a trusted origins allowlist, then forwards the token to the background script.
4. The [background auth handler](src/entrypoints/background/handlers/auth.ts) validates the sender tab URL against the same trusted origins before storing the token.
5. The token is stored in `browser.storage.local` and attached as a `Bearer` header on authenticated API calls.

The extension never sees `user_id` or `organization_id` — the backend resolves identity from the token.

### Content Scripts

| Script | Runs on | What it does |
|---|---|---|
| [`auth-listener.content.ts`](src/entrypoints/auth-listener.content.ts) | `urlert.com` only | Listens for the auth `postMessage`; validates origin; forwards token to background. |
| [`content/index.ts`](src/entrypoints/content/index.ts) | `<all_urls>` | Renders a Shadow DOM overlay icon showing domain safety. Responds to `URLERT_GET_PAGE_HTML` from the background script (for user-initiated scans only). |

The `<all_urls>` content script does **not** automatically send any page data anywhere. The `URLERT_GET_PAGE_HTML` handler only responds to messages from the extension's own background script (`browser.runtime.onMessage` is not accessible to web page JavaScript). Page HTML is only captured when the user explicitly requests a scan.

### On-Demand Scanning

When a user clicks "Send for Analysis":

1. A screenshot is captured via `browser.tabs.captureVisibleTab` (requires `activeTab`).
2. The background script requests page HTML from the content script.
3. Both are sent to `POST /extensions/scan` with the page URL.

The user sees a consent screen ([`ScanConfirm.svelte`](src/entrypoints/popup/views/scan/ScanConfirm.svelte)) listing exactly what will be sent, with a warning to avoid scanning pages containing personal or sensitive information.

### Data Storage

All data is stored in `browser.storage.local` or `browser.storage.sync`:

| Key | Storage | Contents |
|---|---|---|
| `urlertAuth` | local | Auth token, email, expiry (plaintext — see threat model below) |
| `installId` | local | Random UUID for anonymous fingerprinting |
| `domainCache` | local | Cached domain classifications with TTL |
| `urlertActiveScan` | local | Current in-progress scan state |
| `urlertScanHistory` | local | Last 30 completed scan results |
| Settings keys | sync | Overlay preferences (position, auto-dismiss, etc.) |

**Threat model for auth storage:** `browser.storage.local` is not encrypted. This is an accepted limitation of the Chrome extension storage model — any encryption key embedded in the extension would be extractable. Token expiry (set server-side) is the primary mitigation. A malicious process with access to Chrome's profile directory could read this data regardless of client-side encryption.

### HTML Sanitization

Admin notes ([`UrlertNote.svelte`](src/lib/components/domain/UrlertNote.svelte)) are rendered as Markdown via `marked` and sanitized with `DOMPurify` before being injected via `{@html}`. While admin note content is exclusively staff-authored, sanitization is applied as defense-in-depth given that the extension popup has access to privileged `browser.*` APIs.

### What This Extension Does NOT Do

- **No browsing history collection.** Domain classification happens on navigation but results are cached locally; no history is sent to the server.
- **No subdomain leakage.** Domains are normalized to eTLD+1 before any API call — the server never sees full hostnames.
- **No automatic page content capture.** HTML and screenshots are only sent during an explicit user-initiated scan.
- **No cross-extension communication.** `externally_connectable` is not declared.
- **No remote code execution.** No `unsafe-eval`, `unsafe-inline`, or dynamic script loading.
- **No third-party analytics or tracking.**

### Reporting a Vulnerability

See [SECURITY.md](SECURITY.md).
