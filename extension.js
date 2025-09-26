const vscode = require('vscode');


let outputChannel = null;
let extensionMode = null;
let _warnedAboutTitleBarStyle = false;

const colorSchemes = {
  default: {
    ACTIVE: {
      titleBar: {
        "titleBar.activeBackground": "#49124b",
        "titleBar.activeForeground": "#ffffff"
      },
      activityBar: {
        "activityBar.background": "#49124b",
        "activityBar.foreground": "#ffffff"
      },
      statusBar: {
        "statusBar.background": "#49124b",
        "statusBar.foreground": "#ffffff",
        "statusBar.noFolderBackground": "#49124b",
        "statusBar.noFolderForeground": "#ffffff"
      }
    },
    INACTIVE: {
      titleBar: {
        "titleBar.inactiveBackground": "#0f0f0f",
        "titleBar.inactiveForeground": "#e6e6e6"
      },
      activityBar: {
        "activityBar.background": "#0f0f0f",
        "activityBar.foreground": "#e6e6e6"
      },
      statusBar: {
        "statusBar.background": "#0f0f0f",
        "statusBar.foreground": "#e6e6e6",
        "statusBar.noFolderBackground": "#0f0f0f",
        "statusBar.noFolderForeground": "#e6e6e6"
      }
    }
  }
  // Add more schemes here as needed
};

function getColorScheme(cfg) {
  // support both old and new keys
  const schemeName = cfg.get('riverShade.colorScheme', cfg.get('focusColorToggle.colorScheme', 'default'));
  return colorSchemes[schemeName] || colorSchemes['default'];
}

function buildColorsSet(set, settings) {
  const out = {};
  if (!settings) return out;
  if (settings.toggleTitleBar && set.titleBar) Object.assign(out, set.titleBar);
  if (settings.toggleActivityBar && set.activityBar) Object.assign(out, set.activityBar);
  if (settings.toggleStatusBar && set.statusBar) Object.assign(out, set.statusBar);
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
  // create an output channel for debugging in the Extension Host
  outputChannel = vscode.window.createOutputChannel('RiverShade');
  extensionMode = context.extensionMode;
  outputChannel.appendLine(`RiverShade activated (mode=${extensionMode})`);
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
  if (settings.enabled) {
    const scheme = getColorScheme(cfg);
    applyColors(buildColorsSet(vscode.window.state.focused ? scheme.ACTIVE : scheme.INACTIVE, settings))
      .catch(err => {
        try { if (outputChannel) outputChannel.appendLine('Initial applyColors failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
        console.error('Initial applyColors failed', err);
      });
  }

  const sub = vscode.window.onDidChangeWindowState(st => {
    if (!settings.enabled) return;
    const scheme = getColorScheme(cfg);
    applyColors(buildColorsSet(st.focused ? scheme.ACTIVE : scheme.INACTIVE, settings));
  });
  context.subscriptions.push(sub);

  // Reapply when the active color theme changes so the theme-specific block is updated
  if (vscode.window.onDidChangeActiveColorTheme) {
    const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
      if (!settings.enabled) return;
      const scheme = getColorScheme(cfg);
      applyColors(buildColorsSet(vscode.window.state.focused ? scheme.ACTIVE : scheme.INACTIVE, settings));
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
      applyColors(buildColorsSet(isFocused ? scheme.INACTIVE : scheme.ACTIVE, settings))
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
      applyColors(buildColorsSet(isFocused ? scheme.INACTIVE : scheme.ACTIVE, settings))
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
