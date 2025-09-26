const allowedKeys = [
  'titleBar.activeBackground','titleBar.activeForeground',
  'titleBar.inactiveBackground','titleBar.inactiveForeground',
  'quickInputTitle.background','quickInputTitle.foreground','quickInputTitle.inactiveBackground','quickInputTitle.inactiveForeground',
  'peekViewTitle.background','peekViewTitleLabel.foreground','peekViewTitle.inactiveBackground','peekViewTitleLabel.inactiveForeground',
  'editorWidget.background','editorWidget.inactiveBackground',
  'activityBar.background','activityBar.foreground','activityBar.border','activityBar.dropBorder',
  'sideBar.border','panel.border','editorGroup.border','statusBar.border','titleBar.border',
  'statusBar.background','statusBar.noFolderBackground','statusBar.foreground',
  'sash.hoverBorder','panel.dropBorder','activityBar.dropBorder','list.dropBackground','sideBar.dropBackground'
];

function hexToRgb(hex) {
  const h = (hex || '').replace('#','').trim();
  if (h.length !== 6) throw new Error('invalid hex');
  return { r: parseInt(h.substring(0,2),16), g: parseInt(h.substring(2,4),16), b: parseInt(h.substring(4,6),16) };
}

function rgbToHex({r,g,b}) {
  return '#' + [r,g,b].map(n => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
}

function defaultMapPresetToColors(p) {
  const palette = p || {};
  return {
  'titleBar.activeBackground': palette.themePrimary,
  'titleBar.activeForeground': palette.neutralPrimary,
  'titleBar.inactiveBackground': palette.neutralLighter,
  'titleBar.inactiveForeground': palette.neutralSecondary,
  'quickInputTitle.background': palette.themePrimary,
  'quickInputTitle.foreground': palette.neutralPrimary,
  'peekViewTitle.background': palette.themePrimary,
  'peekViewTitleLabel.foreground': palette.neutralPrimary,
  'editorWidget.background': palette.themePrimary,
  'editorWidget.inactiveBackground': palette.neutralLighter,
  'activityBar.background': palette.themeSecondary,
  'activityBar.foreground': palette.neutralPrimary,
  'statusBar.background': palette.neutralQuaternaryAlt,
  'statusBar.noFolderBackground': palette.neutralLighter,
  'rivershade.baseColor': palette.themePrimary,
  'rivershade.darkVariant': palette.themeSecondary,
  'rivershade.lightVariant': palette.themeTertiary,
  'statusBar.border': palette.themeSecondary,
  'titleBar.border': palette.themeSecondary,
  'activityBar.border': palette.themeSecondary,
  'panel.border': palette.themeSecondary,
  'sideBar.border': palette.themeSecondary,
    'editorGroup.border': preset.themeSecondary,
    'sash.hoverBorder': preset.themeTertiary,
    'sideBar.dropBackground': preset.themeTertiary,
    'list.dropBackground': preset.themeTertiary,
    'panel.dropBorder': preset.themeTertiary,
    'activityBar.dropBorder': preset.themeTertiary
  };
}

// New wrapper name: mapPaletteToColors (keeps legacy function name for compatibility)
function mapPaletteToColors(p) {
  return defaultMapPresetToColors(p);
}

module.exports = Object.assign(module.exports || {}, { defaultMapPresetToColors, mapPaletteToColors });

function filterAllowedKeys(mapping, allowed = allowedKeys) {
  const out = {};
  for (const k of Object.keys(mapping || {})) {
    if (allowed.indexOf(k) !== -1) out[k] = mapping[k];
  }
  return out;
}

function blendOKLCHSafe(hexA, hexB, t) {
  try {
    const pkg = require('colorjs.io');
    const Color = pkg && pkg.default ? pkg.default : pkg;
    const ca = new Color(hexA);
    const cb = new Color(hexB);
    const a = ca.to('oklch');
    const b = cb.to('oklch');
    const A = Array.isArray(a) ? a : (a.coords || [a.l,a.c,a.h]);
    const B = Array.isArray(b) ? b : (b.coords || [b.l,b.c,b.h]);
    const La = Number(A[0]); const Ca = Number(A[1]); let Ha = Number(A[2]);
    const Lb = Number(B[0]); const Cb = Number(B[1]); let Hb = Number(B[2]);
    let dh = ((Hb - Ha + 180) % 360) - 180;
    const Hm = Ha + dh * t;
    const Lm = La * (1 - t) + Lb * t;
    const Cm = Ca * (1 - t) + Cb * t;
    let mixed;
    try { mixed = new Color('oklch', [Lm, Cm, Hm]); } catch (e) { mixed = Color.from ? Color.from({ mode:'oklch', coords:[Lm,Cm,Hm] }) : null; }
    if (!mixed) throw new Error('mix failed');
    return mixed.to('srgb').toString({ format: 'hex' });
  } catch (e) {
    try {
      const a = hexToRgb(hexA); const b = hexToRgb(hexB);
      const r = Math.round(a.r*(1-t) + b.r*t);
      const g = Math.round(a.g*(1-t) + b.g*t);
      const bl = Math.round(a.b*(1-t) + b.b*t);
      return rgbToHex({ r, g, b: bl });
    } catch (ee) {
      return hexA;
    }
  }
}

module.exports = { allowedKeys, hexToRgb, rgbToHex, defaultMapPresetToColors, filterAllowedKeys, blendOKLCHSafe };
