#!/usr/bin/env node
/**
 * Generate TypeScript types from the backend OpenAPI spec,
 * filtered to only the /extensions/* endpoints and their
 * transitively-referenced schemas.
 *
 * Usage:
 *   API_URL=http://127.0.0.1:8000 node scripts/generate-api-types.mjs
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';
const OUTPUT = './src/lib/types/api.generated.ts';
const PATH_PREFIX = '/extensions/';

// ── 1. Fetch the full OpenAPI spec ─────────────────────────────────────────

const res = await fetch(`${API_URL}/openapi.json`);
if (!res.ok) throw new Error(`Failed to fetch OpenAPI spec: ${res.status}`);
const spec = await res.json();

// ── 2. Keep only /extensions/* paths ───────────────────────────────────────

const filteredPaths = {};
for (const [path, ops] of Object.entries(spec.paths || {})) {
  if (path.startsWith(PATH_PREFIX)) {
    filteredPaths[path] = ops;
  }
}
spec.paths = filteredPaths;

const kept = Object.keys(filteredPaths).length;
const total = Object.keys(spec.paths || {}).length;
console.log(`Filtered paths: ${kept} kept (from full spec)`);

// ── 3. Collect all $ref targets transitively ───────────────────────────────

const usedRefs = new Set();

function resolveRef(ref) {
  const parts = ref.replace('#/', '').split('/');
  let obj = spec;
  for (const p of parts) {
    obj = obj?.[p];
    if (!obj) return null;
  }
  return obj;
}

function collectRefs(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(collectRefs); return; }
  for (const [key, val] of Object.entries(obj)) {
    if (key === '$ref' && typeof val === 'string') {
      if (!usedRefs.has(val)) {
        usedRefs.add(val);
        const resolved = resolveRef(val);
        if (resolved) collectRefs(resolved);
      }
    } else {
      collectRefs(val);
    }
  }
}

collectRefs(filteredPaths);

// ── 4. Prune components to only what's referenced ─────────────────────────

if (spec.components) {
  for (const category of Object.keys(spec.components)) {
    const original = spec.components[category];
    if (!original || typeof original !== 'object') continue;

    const pruned = {};
    for (const ref of usedRefs) {
      const match = ref.match(new RegExp(`^#/components/${category}/(.+)$`));
      if (match && original[match[1]]) {
        pruned[match[1]] = original[match[1]];
      }
    }
    spec.components[category] = pruned;
  }
}

const schemaCount = Object.keys(spec.components?.schemas || {}).length;
console.log(`Schemas kept: ${schemaCount}`);

// ── 5. Write filtered spec → run openapi-typescript ───────────────────────

const tmpFile = join(tmpdir(), 'urlert-ext-openapi.json');
writeFileSync(tmpFile, JSON.stringify(spec, null, 2));

try {
  execSync(`npx openapi-typescript ${tmpFile} -o ${OUTPUT}`, { stdio: 'inherit' });
  console.log(`✓ Generated ${OUTPUT}`);
} finally {
  try { unlinkSync(tmpFile); } catch {}
}
