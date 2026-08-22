import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * WCAG contrast, asserted against the actual tokens in globals.css (NFR-2).
 *
 * A contrast check done once by hand is true on the day it was run. This parses the real
 * stylesheet, so changing a token to something unreadable fails the build instead.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8');

function channel(component: number): number {
  const c = component / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Read the token values from one `:root` block.
 * Block 0 is light (bare `:root`); block 1 is the dark override.
 */
function tokens(blockIndex: number): Record<string, string> {
  const blocks = [...CSS.matchAll(/:root\s*\{([^}]*)\}/g)].map((match) => match[1]);
  const block = blocks[blockIndex];
  expect(block, `expected a :root block at index ${blockIndex}`).toBeDefined();

  const found: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found[name] = value;
  }
  return found;
}

const LIGHT = tokens(0);
const DARK = { ...LIGHT, ...tokens(1) };

const THEMES = [
  { name: 'light', t: LIGHT },
  { name: 'dark', t: DARK },
];

describe('design token contrast', () => {
  it('parses both themes out of globals.css', () => {
    expect(Object.keys(LIGHT).length).toBeGreaterThan(10);
    expect(DARK.bg).not.toBe(LIGHT.bg);
    expect(DARK.text).not.toBe(LIGHT.text);
  });

  describe.each(THEMES)('$name theme', ({ t }) => {
    it.each([
      ['body text on surface', 'text', 'surface', 4.5],
      ['body text on page background', 'text', 'bg', 4.5],
      ['muted text on surface', 'text-muted', 'surface', 4.5],
      ['muted text on page background', 'text-muted', 'bg', 4.5],
      ['muted text on secondary surface', 'text-muted', 'surface-2', 4.5],
      ['accent text on surface', 'accent', 'surface', 4.5],
      ['accent label on its own button', 'accent-contrast', 'accent', 4.5],
      ['danger text on surface', 'danger', 'surface', 4.5],
      ['danger text on its own soft background', 'danger', 'danger-soft', 4.5],
      ['accent text on soft accent background', 'accent', 'accent-soft', 4.5],
      // 3:1 is the WCAG 1.4.11 threshold for interactive component boundaries.
      ['form control boundary on surface', 'border-strong', 'surface', 3],
      ['form control boundary on page background', 'border-strong', 'bg', 3],
      ['focus ring on page background', 'focus', 'bg', 3],
      ['focus ring on surface', 'focus', 'surface', 3],
    ])('%s clears %s:1', (_label, foreground, background, minimum) => {
      const fg = t[foreground];
      const bg = t[background];
      expect(fg, `token --${foreground} is missing`).toBeDefined();
      expect(bg, `token --${background} is missing`).toBeDefined();
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(minimum);
    });

    it.each([1, 2, 3, 4, 5])('level %i text colour clears 4.5:1 on surface', (level) => {
      const fg = t[`level-${level}-text`];
      expect(fg, `token --level-${level}-text is missing`).toBeDefined();
      expect(contrast(fg, t.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it.each([1, 2, 3, 4, 5])('level %i fill clears 3:1 on both backgrounds', (level) => {
      // Chart bars, radar strokes and level dots carry meaning, so they are graphical
      // objects under WCAG 1.4.11 and need 3:1. Checked against --bg as well as
      // --surface, since --bg is the darker of the two in light mode.
      const fill = t[`level-${level}-fill`];
      expect(fill, `token --level-${level}-fill is missing`).toBeDefined();
      expect(contrast(fill, t.surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(fill, t.bg)).toBeGreaterThanOrEqual(3);
    });

    it.each([1, 2, 3, 4, 5])('level %i figure colour is only a decorative accent', (level) => {
      // --level-N is the raw colour from the source figure. It is deliberately NOT
      // held to 3:1 — it is used only as a card's left border, immediately beside
      // text that states the same level. This test documents that boundary so nobody
      // reaches for it when they need a perceivable graphic.
      const figure = t[`level-${level}`];
      expect(figure, `token --level-${level} is missing`).toBeDefined();
    });
  });

  it('never defines a colour only inside the dark block', () => {
    const darkOnly = Object.keys(tokens(1)).filter((name) => !(name in LIGHT));
    expect(darkOnly).toEqual([]);
  });
});
