// Asset library: the built CSS (data URIs inlined by build.mjs) and the manifest.
import libraryCss from './library.css';
import manifest from './manifest.json';

export const LIBRARY_CSS = libraryCss;
export const MANIFEST = manifest;

const PREFIX = { icons: '--icon-', backgrounds: '--bg-', gradients: '--grad-', fonts: '--font-', cursors: '--cursor-', recipes: '--' };

// All custom property names the library defines.
export function libraryVarNames() {
  const names = new Set();
  for (const [group, prefix] of Object.entries(PREFIX)) for (const a of MANIFEST[group] || []) names.add(prefix + a.name);
  return names;
}

export function libraryIconNames() {
  return MANIFEST.icons.map((i) => i.name);
}

export function libraryClassNames() {
  return MANIFEST.components.map((c) => c.name);
}

// Compact prompt text describing what exists. Stays under ~700 tokens.
export function manifestToPrompt() {
  const list = (items) => items.map((i) => `${i.name} (${i.description})`).join(', ');
  const names = (items) => items.map((i) => i.name).join(', ');
  return [
    'ASSET LIBRARY (already loaded; use by name):',
    `icons 16x16 pixel art, background-image:var(--icon-NAME): ${names(MANIFEST.icons)}.`,
    `tile backgrounds, background-image:var(--bg-NAME): ${list(MANIFEST.backgrounds)}.`,
    `gradients, background-image:var(--grad-NAME): ${names(MANIFEST.gradients)}.`,
    `font stacks, font-family:var(--font-NAME): ${names(MANIFEST.fonts)}.`,
    `cursors, cursor:var(--cursor-NAME): ${names(MANIFEST.cursors)}.`,
    `recipe values var(--NAME): ${list(MANIFEST.recipes)}.`,
    `component classes, attach with /* apply-class: SELECTOR | CLASS */: ${list(MANIFEST.components)}.`,
  ].join('\n');
}

// Shorter variant for the hybrid flow (the pack already uses the library;
// the model only needs the names).
export function manifestToPromptCompact() {
  const names = (items) => items.map((i) => i.name).join(', ');
  return [
    'ASSET LIBRARY (use by name):',
    `icons background-image:var(--icon-NAME): ${names(MANIFEST.icons)}.`,
    `backgrounds var(--bg-NAME): ${names(MANIFEST.backgrounds)}. gradients var(--grad-NAME): ${names(MANIFEST.gradients)}.`,
    `fonts var(--font-NAME): ${names(MANIFEST.fonts)}. recipes: ${names(MANIFEST.recipes)}.`,
    `component classes via /* apply-class: SELECTOR | CLASS */: ${names(MANIFEST.components)}.`,
  ].join('\n');
}

// Rough token estimate used for all budgets (≈4 chars per token for English/CSS).
export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}
