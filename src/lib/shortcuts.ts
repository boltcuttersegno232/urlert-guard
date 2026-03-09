/**
 * Keyboard shortcut helpers — query registered commands and
 * format them for display using clear, readable labels.
 */

// ── Formatting ─────────────────────────────────────────────────────────────

/**
 * Map cryptic symbols (returned by browser.commands.getAll() on Mac)
 * to clear readable text. On Windows/Linux the API already returns
 * readable names like "Alt", "Shift", "Ctrl" — those pass through as-is.
 */
const SYMBOL_TO_LABEL: Record<string, string> = {
  '⌥': 'Opt',
  '⇧': 'Shift',
  '⌘': 'Cmd',
  '⌃': 'Ctrl',
};

/** All known Mac modifier symbols for the tokeniser regex. */
const MAC_SYMBOLS = new Set(Object.keys(SYMBOL_TO_LABEL));

/**
 * Format a browser extension shortcut string into individual key labels.
 *
 * Chrome on Mac returns shortcuts as concatenated symbols with no separator,
 * e.g. "⌥⇧U". Windows/Linux uses "+" separators, e.g. "Alt+Shift+U".
 * This handles both formats.
 */
export function formatShortcut(shortcut: string): string[] {
  if (!shortcut) return [];

  // If "+" separators are present, split normally.
  if (shortcut.includes('+')) {
    return shortcut.split('+').map((p) => SYMBOL_TO_LABEL[p] ?? p);
  }

  // Otherwise tokenise character by character — each known symbol becomes
  // its own token, and remaining characters are grouped as one token.
  const keys: string[] = [];
  let remaining = shortcut;

  while (remaining.length > 0) {
    const char = remaining[0];
    if (MAC_SYMBOLS.has(char)) {
      keys.push(SYMBOL_TO_LABEL[char]);
      remaining = remaining.slice(1);
    } else {
      // Everything left is the final key (e.g. "U", "S")
      keys.push(remaining);
      break;
    }
  }

  return keys;
}

// ── Known commands ─────────────────────────────────────────────────────────

/** Only these commands are shown in the UI. */
const KNOWN_COMMANDS: Record<string, string> = {
  '_execute_action': 'Open URLert Guard',
  'scan-current-page': 'Scan current page',
};

// ── Querying ───────────────────────────────────────────────────────────────

export interface ShortcutInfo {
  /** Internal command name, e.g. "_execute_action" */
  name: string;
  /** Human-readable description from the manifest */
  description: string;
  /** Raw shortcut string from the browser, e.g. "Alt+Shift+U" */
  shortcut: string;
  /** Individual key labels, e.g. ["Opt", "Shift", "U"] */
  keys: string[];
}

/**
 * Return registered keyboard shortcuts for known commands only.
 * Filters out WXT dev commands and other internal entries.
 */
export async function getShortcuts(): Promise<ShortcutInfo[]> {
  try {
    const commands = await browser.commands.getAll();
    return commands
      .filter((cmd) => cmd.name && cmd.name in KNOWN_COMMANDS)
      .map((cmd) => ({
        name: cmd.name ?? '',
        description: cmd.description || KNOWN_COMMANDS[cmd.name!] || '',
        shortcut: cmd.shortcut ?? '',
        keys: formatShortcut(cmd.shortcut ?? ''),
      }));
  } catch {
    return [];
  }
}

/**
 * Convenience: return just the key labels for a specific command,
 * or an empty array if unavailable / not set.
 */
export async function getShortcutFor(commandName: string): Promise<string[]> {
  const all = await getShortcuts();
  return all.find((s) => s.name === commandName)?.keys ?? [];
}
