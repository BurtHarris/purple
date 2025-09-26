/* lib/colorPicker/presetMapper.js
   Map a small preset object to allowed workbench.colorCustomizations keys.
   This module delegates to colorHelpers for low-level transformations.
*/

module.exports = function mapPresetToColors(deps, preset) {
  // deps: { helpers, colors, getColorScheme }
  const helpers = (deps && deps.helpers) || require('../colorHelpers');
  // For now, provide a minimal mapping based on the lightweight preset shape.
  preset = preset || {};
  const out = {};
  if (preset.themePrimary) out['titleBar.activeBackground'] = preset.themePrimary;
  if (preset.themeSecondary) out['statusBar.background'] = preset.themeSecondary;
  if (preset.themeTertiary) out['titleBar.border'] = preset.themeTertiary;
  // Filter allowed keys using helpers
  try { return helpers.filterAllowedKeys(out); } catch (e) { return out; }
};
