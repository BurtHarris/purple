/**
 * @file Map palette to workbench.colorCustomizations keys
 *
 * This module accepts either a plain object with keys { themePrimary, themeSecondary, themeTertiary }
 * or a Palette instance (see `lib/paletteEditor/paletteModel.js`) which implements `normalize()`.
 */

/**
 * @typedef {import('./paletteModel').Palette} PaletteClass
 * @typedef {{ themePrimary?: string|null, themeSecondary?: string|null, themeTertiary?: string|null }} PaletteShape
 */

/**
 * Map a palette to a subset of allowed color customization keys.
 * @param {{helpers?: any}} deps - optional dependencies object, primarily for testing (helpers.filterAllowedKeys)
 * @param {PaletteShape|{palette?:PaletteShape,preset?:PaletteShape}|PaletteClass} paletteOrPreset
 * @returns {Object<string,string>} mapped allowed keys -> color values
 */
module.exports = function mapPaletteToColors(deps, paletteOrPreset) {
  const helpers = (deps && deps.helpers) || require('../colorHelpers');
  const p = paletteOrPreset || {};
  // Support shapes: { palette: {...} } and legacy { preset: {...} }
  const palette = p.palette || p.preset || p;

  // If the object looks like a Palette instance, normalize it first.
  if (palette && typeof palette.normalize === 'function') {
    try { palette.normalize(); } catch (e) { /* ignore normalization errors */ }
  }

  const out = {};
  if (palette.themePrimary) out['titleBar.activeBackground'] = palette.themePrimary;
  if (palette.themeSecondary) out['statusBar.background'] = palette.themeSecondary;
  if (palette.themeTertiary) out['titleBar.border'] = palette.themeTertiary;
  try { return helpers.filterAllowedKeys(out); } catch (e) { return out; }
};
