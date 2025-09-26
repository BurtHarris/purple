/* lib/colorPicker/paletteMapper.js
   Map a small palette (previously called preset) object to allowed workbench.colorCustomizations keys.
   This module delegates to colorHelpers for low-level transformations. Keeps backward-compatible handling of `preset` keys.
*/

module.exports = function mapPaletteToColors(deps, paletteOrPreset) {
  // deps: { helpers, colors, getColorScheme }
  const helpers = (deps && deps.helpers) || require('../colorHelpers');
  const p = paletteOrPreset || {};
  // Accept both `palette` and legacy `preset` shapes if a nested object was passed
  const palette = p.palette || p.preset || p;
  const out = {};
  if (palette.themePrimary) out['titleBar.activeBackground'] = palette.themePrimary;
  if (palette.themeSecondary) out['statusBar.background'] = palette.themeSecondary;
  if (palette.themeTertiary) out['titleBar.border'] = palette.themeTertiary;
  try { return helpers.filterAllowedKeys(out); } catch (e) { return out; }
};
