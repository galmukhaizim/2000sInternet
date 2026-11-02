// Library entry for harnesses (eval, training). Built as IIFE global `RetroWebLib`.
// Grows with each phase: summarizer, validator, inspector, fallbacks, assets.
export { VERSION } from './config.js';
export { STYLES } from './model/styles.js';
export { svgToDataUri, dataUriToSvg } from './util/svg-data-uri.js';
