// Library entry for harnesses (eval, training). Built as IIFE global `RetroWebLib`.
export { VERSION } from './config.js';
export { STYLES, pickStyle, describeStyle } from './model/styles.js';
export { svgToDataUri, dataUriToSvg } from './util/svg-data-uri.js';
export { LIBRARY_CSS, MANIFEST, manifestToPrompt, libraryVarNames, libraryIconNames, libraryClassNames, estimateTokens } from './assets/index.js';
export { summarizePage, renderSummary, uniqueSelector, patternSelector, createMeasure } from './summarize.js';
export { parseCss, validateCss, extractDirectives, validateApplyClass, applyClassDirectives, probeSelector } from './validate.js';
export { createSlots, StyleSlot, RuleStreamer } from './apply.js';
