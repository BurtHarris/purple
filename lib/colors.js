/** highlight color module
 * 
 * The idea here is to compose a pallette of colors that work well together
 * to apply to the vscode color scheme overtop of a base theme.  The primary reason
 * for doing this seperately from the main scheme ist to bring back convention of 
 * the title bar to act as a visual indicator of focus/active state.
 * 
 * Rather than spelling out all the colors one at a ttime, we calculate from some key-colors
 * and calculate some based on them.  
 */



function adjustColor(color, contrast, brightness) {
  // Use colorjs.io (CommonJS-safe) to adjust OKLCH lightness.
  try {
    const pkg = require('colorjs.io');
    const Color = pkg && pkg.default ? pkg.default : pkg;
    const input = typeof color === 'string' ? color : String(color);

    // Create a Color instance
    let c;
    try {
      c = new Color(input);
    } catch (e) {
      // fallback to parse/static method
      c = Color.parse ? Color.parse(input) : null;
    }
    if (!c) return color;

    // Try to read OKLCH coordinates
    let L, Cc, H;
    if (c.oklch && typeof c.oklch === 'object') {
      L = c.oklch.l; Cc = c.oklch.c; H = c.oklch.h;
    } else {
      const as = (() => {
        try { return c.to('oklch'); } catch (e) { return null; }
      })();
      if (as) {
        if (Array.isArray(as)) [L, Cc, H] = as;
        else if (as.coords) [L, Cc, H] = as.coords;
        else { L = as.l || as.L || 0; Cc = as.c || as.C || 0; H = as.h || as.H || 0; }
      }
    }

    // If nothing sensible, fall back to returning original
    if (L === undefined || Cc === undefined || H === undefined) {
      try { return c.to('srgb').toString({ format: 'hex' }); } catch (e) { return color; }
    }

    // Determine scale: color.js often uses 0..100 for L; if L>2 assume percent scale
    const lIsPercent = (L > 2);
    // Apply brightness delta if provided (treat numeric brightness as delta in 0..1)
    if (Number.isFinite(brightness)) {
      if (lIsPercent) {
        L = Math.max(0, Math.min(100, L + (brightness * 100)));
      } else {
        L = Math.max(0, Math.min(1, L + brightness));
      }
    }

    // Construct new color in OKLCH and output sRGB hex
    try {
      let newColor;
      try {
        // Preferred: constructor accepts space + coords
        newColor = new Color('oklch', [L, Cc, H]);
      } catch (e) {
        // Fallback: static factory
        newColor = Color.from ? Color.from({ mode: 'oklch', coords: [L, Cc, H] }) : null;
      }
      if (!newColor) return color;
      const outHex = newColor.to('srgb').toString({ format: 'hex' });
      return outHex;
    } catch (e) {
      try { return c.to('srgb').toString({ format: 'hex' }); } catch (ee) { return color; }
    }
  } catch (e) {
    return color;
  }
}


const COLOR_KEYS = [
  'activityBar.border',
  'activityBar.dropBorder',
  'activityBar.foreground',
  'editorGroup.border',
  'panel.border',
  'panel.dropBorder',
  'peekViewTitleLabel.foreground',
  'peekViewTitleLabel.inactiveForeground',
  'quickInputTitle.foreground',
  'quickInputTitle.inactiveForeground',
  'sash.hoverBorder',
  'sideBar.border',
  'statusBar.border',
  'rivershade.baseColor',
  'rivershade.darkVariant',
  'rivershade.lightVariant',
  'titleBar.activeForeground',
  'titleBar.border',
  'titleBar.inactiveForeground'
];

  /**
   * Map a fluent-style preset to a set of workbench color customizations focused on
   * title bar, activity/status bars and related chrome. The preset is expected to
   * provide themePrimary, themeSecondary, themeTertiary and neutral tokens.
   */
  function mapPaletteToTitlebarColors(palette) {
    const p = palette || {};
    const primary = p.themePrimary || p.primary || '#000000';
    const secondary = p.themeSecondary || p.secondary || primary;
    const tertiary = p.themeTertiary || p.themeTertiary || primary;

    // Foreground/text tokens (for dark themes these are light; for light themes they are dark)
    const fgPrimary = p.neutralPrimary || p.foreground || '#ffffff';
    const fgSecondary = p.neutralSecondary || p.foregroundSecondary || fgPrimary;
    const fgTertiary = p.neutralTertiary || fgSecondary;

    // Surface/background tones
    const bgActive = primary;
    const bgInactive = p.neutralLight || '#2f2f2f';
    const activityBarBg = secondary;
    const statusBarBg = primary;

    return {
      // Title bar active
      'titleBar.activeBackground': bgActive,
      'titleBar.activeForeground': fgPrimary,
      // Title bar inactive
      'titleBar.inactiveBackground': bgInactive,
      'titleBar.inactiveForeground': fgSecondary,

      // Quick input and peek view mirror titlebar tones
      'quickInputTitle.background': bgActive,
      'quickInputTitle.foreground': fgPrimary,
      'quickInputTitle.inactiveBackground': bgInactive,
      'quickInputTitle.inactiveForeground': fgSecondary,

      'peekViewTitle.background': bgActive,
      'peekViewTitleLabel.foreground': fgPrimary,
      'peekViewTitle.inactiveBackground': bgInactive,
      'peekViewTitleLabel.inactiveForeground': fgSecondary,

      // Editor widget (find/replace dialog, etc.)
      'editorWidget.background': bgActive,
      'editorWidget.inactiveBackground': bgInactive,

      // Activity bar & status bar
      'activityBar.background': activityBarBg,
      'activityBar.foreground': fgPrimary,
      'statusBar.background': statusBarBg,
      'statusBar.noFolderBackground': bgInactive,

      // Rivershade helper tokens
      'rivershade.baseColor': primary,
      'rivershade.darkVariant': secondary,
      'rivershade.lightVariant': tertiary,

      // Borders
      'statusBar.border': secondary,
      'titleBar.border': secondary,
      'activityBar.border': secondary,
      'panel.border': secondary,
      'sideBar.border': secondary,
      'editorGroup.border': secondary,

      // Misc accents
      'sash.hoverBorder': tertiary,
      'sideBar.dropBackground': tertiary,
      'list.dropBackground': tertiary,
      'panel.dropBorder': tertiary,
      'activityBar.dropBorder': tertiary
    };
  }

  // Backwards-compatible alias
  function mapPresetToTitlebarColors(preset) { return mapPaletteToTitlebarColors(preset); }

// Subset: all keys that are background-related (includes inactive/active/drop/noFolder variants)
const BACKGROUNDS = [
  'activityBar.background',
  'editorWidget.background',
  'list.dropBackground',
  'peekViewTitle.background',
  'quickInputTitle.background',
  'sideBar.dropBackground',
  'statusBar.background',
  'statusBar.noFolderBackground',
  // active backgrounds moved to ACTIVE_BACKGROUND
];

// Inactive/background variants extracted separately
const INACTIVE_BACKGROUND = [
  'editorWidget.inactiveBackground',
  'peekViewTitle.inactiveBackground',
  'quickInputTitle.inactiveBackground',
  'titleBar.inactiveBackground'
];

// Active background variants (e.g., titleBar active state)
const ACTIVE_BACKGROUND = [
  'titleBar.activeBackground'
];


let vscode;
let applyColors;
let getColorScheme;
let getActiveThemeName;

function buildColorsSet(_scheme, _settings) {
  const fs = require('fs');
  const path = require('path');
  const colorsPath = path.join(__dirname, '..', 'colors', (_scheme || 'default') + '.json');
  let payload = {};
  if (fs.existsSync(colorsPath)) {
    try { payload = JSON.parse(fs.readFileSync(colorsPath, 'utf8')); } catch (e) { payload = {}; }
  }
  const s = _settings || {};
  const out = {};

  // If caller provided a palette object (or legacy preset), map it into the expected keys
  const paletteSource = (s.palette && typeof s.palette === 'object') ? s.palette : (s.preset && typeof s.preset === 'object' ? s.preset : null);
  if (paletteSource) {
    const presetColors = mapPaletteToTitlebarColors(paletteSource);
    Object.assign(out, presetColors);
  }

  function copyKey(k) { if (Object.prototype.hasOwnProperty.call(payload, k)) out[k] = payload[k]; }

  if (s.toggleTitleBar !== false) {
    [
      'titleBar.activeBackground','titleBar.activeForeground',
      'quickInputTitle.background','quickInputTitle.foreground',
      'peekViewTitle.background','peekViewTitleLabel.foreground',
      'editorWidget.background','titleBar.inactiveBackground',
      'titleBar.inactiveForeground','quickInputTitle.inactiveBackground',
      'quickInputTitle.inactiveForeground','peekViewTitle.inactiveBackground',
      'peekViewTitleLabel.inactiveForeground','editorWidget.inactiveBackground'
    ].forEach(copyKey);
  }

  if (s.toggleActivityBar !== false) {
    ['activityBar.background','activityBar.foreground'].forEach(copyKey);
  }

  if (s.toggleStatusBar !== false) {
    ['statusBar.background','statusBar.noFolderBackground'].forEach(copyKey);
  }

  return out;
}

async function installBlingInternal() {
  const cfg = vscode.workspace.getConfiguration();
  const scheme = getColorScheme(cfg);
  const settings = { toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true };
  const colors = buildColorsSet(scheme, settings);
  await applyColors(colors);
  return true;
}

async function removeBlingInternal() {
  const cfg = vscode.workspace.getConfiguration();
  const scheme = getColorScheme(cfg);
  const blingPrefixes = ['titleBar.', 'activityBar.', 'statusBar.'];
  const settingsForRemoval = { toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true };
  const exactKeys = Object.keys(buildColorsSet(scheme, settingsForRemoval) || {});
  const targets = [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace];
  const inspect = cfg.inspect('workbench.colorCustomizations') || {};

  const updates = [];
  for (const t of targets) {
    let currentValue = {};
    if (t === vscode.ConfigurationTarget.Global) {
      currentValue = inspect.globalValue && Object.keys(inspect.globalValue).length ? inspect.globalValue
        : (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length ? inspect.globalLocalValue : (inspect.globalValue || inspect.globalLocalValue || {}));
    } else {
      currentValue = inspect.workspaceValue && Object.keys(inspect.workspaceValue).length ? inspect.workspaceValue
        : (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length ? inspect.workspaceFolderValue : (inspect.workspaceValue || inspect.workspaceFolderValue || {}));
    }

    if (!currentValue || Object.keys(currentValue).length === 0) continue;

    const clone = JSON.parse(JSON.stringify(currentValue));
    const theme = getActiveThemeName();
    let changed = false;

    for (const k of exactKeys) {
      if (k in clone) { delete clone[k]; changed = true; }
    }
    for (const k of Object.keys(clone)) {
      for (const p of blingPrefixes) {
        if (k.startsWith(p)) { delete clone[k]; changed = true; break; }
      }
    }

    if (theme) {
      const themeKey = `[${theme}]`;
      if (clone[themeKey]) {
        for (const k of exactKeys) {
          if (k in clone[themeKey]) { delete clone[themeKey][k]; changed = true; }
        }
        for (const k of Object.keys(clone[themeKey] || {})) {
          for (const p of blingPrefixes) {
            if (k.startsWith(p)) { delete clone[themeKey][k]; changed = true; break; }
          }
        }
        if (clone[themeKey] && Object.keys(clone[themeKey]).length === 0) delete clone[themeKey];
      }
    }

    if (changed) {
      const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
      updates.push(cfg.update('workbench.colorCustomizations', valueToSet, t));
    }
  }

  // Attempt to clear per-folder settings where supported
  const folderUpdates = [];
  try {
    const folders = vscode.workspace.workspaceFolders || [];
    for (const f of folders) {
      try {
        const folderCfg = vscode.workspace.getConfiguration(undefined, f.uri);
        folderUpdates.push(folderCfg.update('workbench.colorCustomizations', undefined, vscode.ConfigurationTarget.WorkspaceFolder).catch(() => {}));
      } catch (e) {
        // ignore folder-scope errors
      }
    }
  } catch (e) {
    // ignore
  }

  if (updates.length === 0 && folderUpdates.length === 0) return false;

  await Promise.all(updates);
  await Promise.all(folderUpdates);
  return true;
}

function init(runtime) {
  vscode = runtime.vscode;
  applyColors = runtime.applyColors;
  getColorScheme = runtime.getColorScheme;
  getActiveThemeName = runtime.getActiveThemeName;
  return {
    buildColorsSet,
    installBling: installBlingInternal,
    removeBling: removeBlingInternal
  };
}

module.exports = { init };
