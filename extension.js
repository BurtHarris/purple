// Install purple bling customizations
async function installBling() {
  const cfg = vscode.workspace.getConfiguration();
  const scheme = getColorScheme(cfg);
  const settings = {
    toggleTitleBar: true,
    toggleActivityBar: true,
    toggleStatusBar: true
  };
  const colors = buildColorsSet(scheme, settings);
  await applyColors(colors);
  vscode.window.showInformationMessage('RiverShade: color customizations installed.');
}

// Remove all bling customizations set by the extension
async function removeBling() {
  const cfg = vscode.workspace.getConfiguration();
  const current = cfg.get('workbench.colorCustomizations') || {};
  // Clone the config object to avoid mutating VS Code proxy
  const clone = JSON.parse(JSON.stringify(current));
  const scheme = getColorScheme(cfg);
  const keysToRemove = Object.keys(scheme);
  let changed = false;
  for (const k of keysToRemove) {
    if (k in clone) {
      delete clone[k];
      changed = true;
    }
  }
  // Also remove theme-scoped blocks if present
  const theme = getActiveThemeName();
  if (theme) {
    const themeKey = `[${theme}]`;
    if (clone[themeKey]) {
      for (const k of keysToRemove) {
        if (k in clone[themeKey]) {
          delete clone[themeKey][k];
          changed = true;
        }
      }
    }
  }
  if (changed) {
    await cfg.update('workbench.colorCustomizations', clone, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('RiverShade: bling removed.');
  } else {
    vscode.window.showInformationMessage('RiverShade: no bling to remove.');
  }
}
const vscode = require('vscode');


let outputChannel = null;
let extensionMode = null;
let _warnedAboutTitleBarStyle = false;



// Restored purple color scheme (single set, no ACTIVE/INACTIVE split)
const colorSchemes = {
  default: {
    "titleBar.activeBackground": "#49124b",
    "titleBar.activeForeground": "#ffffff",
    "titleBar.activeBorder": "#99459c",
    "activityBar.background": "#49124b",
    "activityBar.foreground": "#ffffff",
    "activityBar.border": "#99459c",
    "statusBar.background": "#49124b",
    "statusBar.foreground": "#ffffff",
    "statusBar.noFolderBackground": "#0f0f0f",
    "statusBar.noFolderForeground": "#e6e6e6",
    "statusBar.debuggingBackground": "#0f0f0f",
    "statusBar.debuggingForeground": "#e6e6e6",
    "titleBar.inactiveBackground": "#0f0f0f",
    "titleBar.inactiveForeground": "#e6e6e6",
    "activityBar.inactiveBackground": "#0f0f0f",
    "activityBar.inactiveForeground": "#e6e6e6"
  }
};

function getColorScheme(cfg) {
  // support both old and new keys
  const schemeName = cfg.get('riverShade.colorScheme', cfg.get('focusColorToggle.colorScheme', 'default'));
  return colorSchemes[schemeName] || colorSchemes['default'];
}

function buildColorsSet(scheme, settings) {
  const out = {};
  if (!settings) return out;
  // Only include keys for enabled UI parts
  if (settings.toggleTitleBar) {
    out["titleBar.activeBackground"] = scheme["titleBar.activeBackground"];
    out["titleBar.activeForeground"] = scheme["titleBar.activeForeground"];
    out["titleBar.activeBorder"] = scheme["titleBar.activeBorder"];
    out["titleBar.inactiveBackground"] = scheme["titleBar.inactiveBackground"];
    out["titleBar.inactiveForeground"] = scheme["titleBar.inactiveForeground"];
  }
  if (settings.toggleActivityBar) {
    out["activityBar.background"] = scheme["activityBar.background"];
    out["activityBar.foreground"] = scheme["activityBar.foreground"];
    out["activityBar.border"] = scheme["activityBar.border"];
    out["activityBar.inactiveBackground"] = scheme["activityBar.inactiveBackground"];
    out["activityBar.inactiveForeground"] = scheme["activityBar.inactiveForeground"];
  }
  if (settings.toggleStatusBar) {
    out["statusBar.background"] = scheme["statusBar.background"];
    out["statusBar.foreground"] = scheme["statusBar.foreground"];
    out["statusBar.noFolderBackground"] = scheme["statusBar.noFolderBackground"];
    out["statusBar.noFolderForeground"] = scheme["statusBar.noFolderForeground"];
    out["statusBar.debuggingBackground"] = scheme["statusBar.debuggingBackground"];
    out["statusBar.debuggingForeground"] = scheme["statusBar.debuggingForeground"];
  }
  return out;
}

function merge(current, patch) {
  return Object.assign({}, current || {}, patch || {});
}

function applyColors(colors) {
  const cfg = vscode.workspace.getConfiguration();
  const current = cfg.get('workbench.colorCustomizations') || {};

  // Merge into the general colorCustomizations
  const merged = merge(current, colors);

  // Also merge into the active theme-specific block (if present or create one)
  // Theme keys in workbench.colorCustomizations use the format: "[Theme Name]"
  const theme = getActiveThemeName();
  if (theme) {
    const themeKey = `[${theme}]`;
    const themeBlock = current[themeKey] || {};
    merged[themeKey] = merge(themeBlock, colors);
  }

  // Debug: show merged color customizations in the output channel so it's visible
  try {
    if (outputChannel) {
      outputChannel.appendLine('Applying color customizations:');
      outputChannel.appendLine(JSON.stringify(merged, null, 2));
    }
  } catch (e) {
    // ignore logging errors
  }

  // If the merged colors include titleBar keys but the user hasn't enabled the
  // custom (drawn by VS Code) title bar, the title bar won't change. Warn once
  // so users understand why their title bar may not recolor.
  try {
    const hasTitleBarKeys = Object.keys(merged).some(k => k.startsWith('titleBar.')) ||
      Object.keys(merged).some(k => k.startsWith('[') && merged[k] && Object.keys(merged[k]).some(kk => kk.startsWith('titleBar.')));
    if (hasTitleBarKeys && !_warnedAboutTitleBarStyle) {
      const titleBarStyle = vscode.workspace.getConfiguration().get('window.titleBarStyle');
      if (titleBarStyle !== 'custom') {
        // Auto-set the title bar style to custom so the title bar recolors as expected.
        try {
          // update at global (user) level to affect the native window
          vscode.workspace.getConfiguration().update('window.titleBarStyle', 'custom', vscode.ConfigurationTarget.Global);
        } catch (e) {
          // If we can't write settings, fall back to showing the informational message once
          _warnedAboutTitleBarStyle = true;
          try { vscode.window.showInformationMessage('RiverShade: to recolor the title bar set "window.titleBarStyle": "custom" in Settings'); } catch (e) { /* ignore UI errors */ }
        }
      }
    }
  } catch (e) { /* ignore check errors */ }

  // Determine where to write the customizations: global/workspace/both
  const updateTargetSetting = vscode.workspace.getConfiguration().get('focusColorToggle.updateTarget', 'global');
  const targets = mapUpdateTargetToConfigTargets(updateTargetSetting);

  // Apply to each target (usually just one). Return a Promise that resolves when all updates complete.
  const updates = targets.map(t => cfg.update('workbench.colorCustomizations', merged, t));
  return Promise.all(updates);
}

function mapUpdateTargetToConfigTargets(setting) {
  switch (setting) {
    case 'workspace':
      return [vscode.ConfigurationTarget.Workspace];
    case 'both':
      return [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace];
    case 'global':
    default:
      return [vscode.ConfigurationTarget.Global];
  }
}

// Return the currently active theme name. Prefer the explicit setting when present,
// otherwise fall back to the runtime active color theme label (works when theme is
// set by workspace or defaults and not stored in settings.json).
function getActiveThemeName() {
  const configured = vscode.workspace.getConfiguration('workbench').get('colorTheme');
  if (configured) return configured;
  // activeColorTheme is available in newer VS Code APIs and exposes the label.
  const active = vscode.window.activeColorTheme;
  if (active && typeof active.label === 'string') return active.label;
  return null;
}

function activate(context) {
  // Register install/remove commands
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.installBling', installBling));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.removeBling', removeBling));
  // create an output channel for debugging in the Extension Host
  outputChannel = vscode.window.createOutputChannel('RiverShade');
  extensionMode = context.extensionMode;
  outputChannel.appendLine(`RiverShade extension: activate() called (mode=${extensionMode})`);
  try {
    vscode.window.showInformationMessage('RiverShade extension activated.');
  } catch (e) { /* ignore UI errors */ }
  try {
    // show where the runtime loaded this extension from so developers can verify
    const loadedFrom = context && context.extensionPath ? context.extensionPath : __dirname;
    outputChannel.appendLine(`RiverShade loaded from: ${loadedFrom}`);
    // In development/test modes also show a one-time information message so it's obvious
    if (extensionMode === vscode.ExtensionMode.Development || extensionMode === vscode.ExtensionMode.Test) {
      try { vscode.window.showInformationMessage(`RiverShade loaded from: ${loadedFrom}`); } catch (e) { /* ignore UI errors */ }
    }
  } catch (e) { /* ignore logging errors */ }
  // read configuration early so we can include it in the activation artifact and
  // avoid referencing `settings` before it's declared
  const cfg = vscode.workspace.getConfiguration();
  // support both old keys (focusColorToggle.*) and new riverShade.* aliases
  const settings = {
    enabled: cfg.get('riverShade.enabled', cfg.get('focusColorToggle.enabled', true)),
    toggleTitleBar: cfg.get('riverShade.toggleTitleBar', cfg.get('focusColorToggle.toggleTitleBar', true)),
    toggleActivityBar: cfg.get('riverShade.toggleActivityBar', cfg.get('focusColorToggle.toggleActivityBar', true)),
    toggleStatusBar: cfg.get('riverShade.toggleStatusBar', cfg.get('focusColorToggle.toggleStatusBar', true)),
    colorScheme: cfg.get('riverShade.colorScheme', cfg.get('focusColorToggle.colorScheme', 'default'))
  };
  // When running in development or test mode, also log to console and write an activation file
  if (extensionMode === vscode.ExtensionMode.Development || extensionMode === vscode.ExtensionMode.Test) {
    console.log(`RiverShade activated (mode=${extensionMode})`);
    try {
      // write a simple activation artifact to the .vscode-test/logs folder so tests/CI can read it
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join(__dirname, '.vscode-test', 'logs');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      const theme = getActiveThemeName();
      const activation = {
        activatedAt: new Date().toISOString(),
        mode: String(extensionMode),
        theme: theme || null,
        extensionPath: context && context.extensionPath ? context.extensionPath : __dirname
      };
      try { activation.settings = settings; } catch (e) { activation.settings = null; }
      fs.writeFileSync(path.join(logsDir, 'rivershade-activation.json'), JSON.stringify(activation, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write activation log:', e && e.message);
    }
  }

  // apply initial state
  async function applyColorsAndMaybeReload(colors) {
    await applyColors(colors);
    const reload = cfg.get('riverShade.reloadWindowOnChange', cfg.get('focusColorToggle.reloadWindowOnChange', false));
    if (reload) {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  if (settings.enabled) {
  const scheme = getColorScheme(cfg);
  applyColorsAndMaybeReload(buildColorsSet(scheme, settings))
      .catch(err => {
        try { if (outputChannel) outputChannel.appendLine('Initial applyColorsAndMaybeReload failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
        console.error('Initial applyColorsAndMaybeReload failed', err);
      });
  }

  const sub = vscode.window.onDidChangeWindowState(st => {
    if (!settings.enabled) return;
  const scheme = getColorScheme(cfg);
  applyColorsAndMaybeReload(buildColorsSet(scheme, settings));
  });
  context.subscriptions.push(sub);

  // Reapply when the active color theme changes so the theme-specific block is updated
  if (vscode.window.onDidChangeActiveColorTheme) {
    const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
      if (!settings.enabled) return;
  const scheme = getColorScheme(cfg);
  applyColorsAndMaybeReload(buildColorsSet(scheme, settings));
    });
    context.subscriptions.push(themeSub);
  }

  const disposable = vscode.commands.registerCommand('focusColorToggle.toggle', () => {
    const isFocused = vscode.window.state.focused;
    if (!settings.enabled) {
      vscode.window.showInformationMessage('Focus Color Toggle is disabled in settings');
      return;
    }
    try {
  const scheme = getColorScheme(cfg);
  applyColorsAndMaybeReload(buildColorsSet(scheme, settings))
        .then(() => vscode.window.showInformationMessage('Toggled focus colors'))
        .catch(err => {
          try { if (outputChannel) outputChannel.appendLine('focusColorToggle.toggle failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
          console.error('focusColorToggle.toggle failed', err);
          vscode.window.showErrorMessage('Failed to apply focus colors');
        });
    } catch (err) {
      console.error('focusColorToggle.toggle handler error', err);
    }
  });
  context.subscriptions.push(disposable);

  // register new RiverShade command id as an alias
  const disposable2 = vscode.commands.registerCommand('rivershade.toggle', () => {
    const isFocused = vscode.window.state.focused;
    if (!settings.enabled) {
      vscode.window.showInformationMessage('RiverShade is disabled in settings');
      return;
    }
    try {
  const scheme = getColorScheme(cfg);
  applyColorsAndMaybeReload(buildColorsSet(scheme, settings))
        .then(() => vscode.window.showInformationMessage('RiverShade: Toggled focus colors'))
        .catch(err => {
          try { if (outputChannel) outputChannel.appendLine('rivershade.toggle failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
          console.error('rivershade.toggle failed', err);
          vscode.window.showErrorMessage('Failed to apply RiverShade focus colors');
        });
    } catch (err) {
      console.error('rivershade.toggle handler error', err);
    }
  });
  context.subscriptions.push(disposable2);
}

exports.activate = activate;
exports.deactivate = () => {};
