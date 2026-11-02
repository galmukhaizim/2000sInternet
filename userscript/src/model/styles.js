// Single source of truth for sub-styles is training/styles.json (shared with the
// teacher pipeline). Bundled at build time.
import styles from '../../../training/styles.json';

export const STYLES = styles;

export function getStyle(id) {
  return STYLES.find((s) => s.id === id) || null;
}

export function pickStyle(id, rng = Math.random) {
  if (id && id !== 'random') {
    const s = getStyle(id);
    if (s) return s;
  }
  return STYLES[Math.floor(rng() * STYLES.length)];
}

export function describeStyle(s) {
  return `${s.name}: ${s.description} Palette: ${s.palette.join(', ')}. Fonts: ${s.fonts.join(', ')}. Motifs: ${s.motifs.join(', ')}.`;
}
