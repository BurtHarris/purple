/**
 * Palette generator using Color.js (colorjs.io)
 * Produces a small set of perceptual variants from a base color using OKLCH.
 *
 * Output keys (sRGB hex):
 * - base
 * - light  (lightness step 1)
 * - lighter (lightness step 2)
 * - dark   (darkness step 1)
 * - darker (darkness step 2)
 * - saturated
 * - desaturated
 */
import ColorPkg from 'colorjs.io';
const Color = ColorPkg && ColorPkg.default ? ColorPkg.default : ColorPkg;

/**
 * Build a small perceptual palette from `baseColor`.
 * @param {string} baseColor - CSS color string or hex (e.g. '#7b3fbf')
 * @returns {{base:string, light:string|null, lighter:string|null, dark:string|null, darker:string|null, saturated:string|null, desaturated:string|null}}
 */
function buildPalette(baseColor) {
  // Hard-coded tuning constants (module simplified — no options accepted)
  const lightStep = 0.08; // delta L per step (0..1) or 8 if L is 0..100
  const darkStep = -0.08;
  const satMultiplier = 1.15;
  const desatMultiplier = 0.75;
  const steps = 2; // fixed two light/dark variants

  let c;
  try {
    c = new Color(baseColor);
  } catch (e) {
    c = Color.parse ? Color.parse(String(baseColor)) : null;
  }
  if (!c) throw new Error('Invalid baseColor: ' + baseColor);

  // Get OKLCH coords; Color.js tends to use L in 0..100; normalize to both forms
  const asOk = (() => { try { return c.to('oklch'); } catch (e) { return null; } })();
  let L = 0, C = 0, H = 0, lIsPercent = false;
  if (Array.isArray(asOk)) {
    [L, C, H] = asOk;
  } else if (asOk && asOk.coords) {
    [L, C, H] = asOk.coords;
  } else if (asOk && typeof asOk === 'object') {
    L = asOk.l || asOk.L || 0; C = asOk.c || asOk.C || 0; H = asOk.h || asOk.H || 0;
  }
  if (L > 2) lIsPercent = true; // treat L as 0..100

  function applyL(delta) {
    let newL = lIsPercent ? (L + delta * (lIsPercent ? 100 : 1)) : (L + delta);
    if (lIsPercent) newL = Math.max(0, Math.min(100, newL)); else newL = Math.max(0, Math.min(1, newL));
    let nc;
    try { nc = new Color('oklch', [newL, C, H]); } catch (e) { nc = Color.from ? Color.from({ mode: 'oklch', coords: [newL, C, H] }) : null; }
    return nc ? nc.to('srgb').toString({ format: 'hex' }) : null;
  }

  function applyC(mult) {
    const newC = C * mult;
    let nc;
    try { nc = new Color('oklch', [L, newC, H]); } catch (e) { nc = Color.from ? Color.from({ mode: 'oklch', coords: [L, newC, H] }) : null; }
    return nc ? nc.to('srgb').toString({ format: 'hex' }) : null;
  }

  const palette = { base: c.to('srgb').toString({ format: 'hex' }) };

  // generate exactly 2 light/dark steps and name them explicitly
  palette.light = applyL(lightStep * 1);
  palette.lighter = applyL(lightStep * 2);
  palette.dark = applyL(darkStep * 1);
  palette.darker = applyL(darkStep * 2);

  // saturation variants
  palette.saturated = applyC(satMultiplier);
  palette.desaturated = applyC(desatMultiplier);

  return palette;
}

export { buildPalette };
