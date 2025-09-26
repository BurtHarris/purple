// Pallet generator using Color.js (colorjs.io)
// Produces perceptual variants (light/dark, saturated/desaturated) from a base color.

function buildPalette(baseColor, options) {
  options = options || {};
  const ColorPkg = require('colorjs.io');
  const Color = ColorPkg && ColorPkg.default ? ColorPkg.default : ColorPkg;

  // sensible defaults
  const cfg = Object.assign({
    lightStep: 0.08, // delta L per step (if L is 0..1), or 8 if L is 0..100
    darkStep: -0.08,
    satMultiplier: 1.15,
    desatMultiplier: 0.75,
    steps: 2
  }, options);

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

  // generate light/dark steps
  for (let i = 1; i <= cfg.steps; i++) {
    palette['lighter'.replace(/er$/, i===1? '': '') + i] = applyL(cfg.lightStep * i);
    palette['darker' + i] = applyL(cfg.darkStep * i);
  }

  // saturation variants
  palette.saturated = applyC(cfg.satMultiplier);
  palette.desaturated = applyC(cfg.desatMultiplier);

  return palette;
}

module.exports = { buildPalette };
