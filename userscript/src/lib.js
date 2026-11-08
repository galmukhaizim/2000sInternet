// Library entry for harnesses (eval, training). Built as IIFE global `RetroWebLib`.
export { VERSION } from './config.js';
export { STYLES, pickStyle, describeStyle } from './model/styles.js';
export { svgToDataUri, dataUriToSvg } from './util/svg-data-uri.js';
export { LIBRARY_CSS, MANIFEST, manifestToPrompt, libraryVarNames, libraryIconNames, libraryClassNames, estimateTokens } from './assets/index.js';
export { summarizePage, renderSummary, uniqueSelector, patternSelector, createMeasure } from './summarize.js';
export { parseCss, validateCss, extractDirectives, validateApplyClass, applyClassDirectives, probeSelector } from './validate.js';
export { createSlots, StyleSlot, RuleStreamer } from './apply.js';
export { sanitizeSvg } from './icons/sanitize.js';
export { createIconResolver, matchLibraryIcon } from './icons/index.js';
export { createIconCache, iconHash } from './icons/cache.js';
export { buildIconRequest, extractSvgFromResponse, ICON_SYSTEM_PROMPT } from './icons/claude.js';
export { DESIGN_SYSTEM_PROMPT, REPAIR_SYSTEM_PROMPT, designMessages, repairMessages } from './model/prompts.js';
export { inspectPage, snapshotVisibility, renderReport, createInspectorMeasure, contrastRatio, parseColor } from './repair/inspect.js';
export { buildFallbackCss } from './repair/fallbacks.js';
export { runRepairLoop, trimCssForReport } from './repair/loop.js';
export { renderPack, iconForText, selectorsFromSummary, listPackStyles, THEMES } from './packs/index.js';
