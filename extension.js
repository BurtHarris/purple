const vscode = require('vscode');

const ACTIVE = {
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
    "statusBar.foreground": "#ffffff"
  }
};

const INACTIVE = {
  titleBar: {
    "titleBar.inactiveBackground": "#0f0f0f",
    "titleBar.inactiveForeground": "#e6e6e6"
  },
  activityBar: {
    "activityBar.inactiveBackground": "#0f0f0f",
    "activityBar.inactiveForeground": "#e6e6e6"
  },
  statusBar: {
    "statusBar.noFolderBackground": "#0f0f0f",
    "statusBar.noFolderForeground": "#e6e6e6"
  }
};

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
  const merged = merge(current, colors);
  return cfg.update('workbench.colorCustomizations', merged, vscode.ConfigurationTarget.Global);
}

function activate(context) {
  const cfg = vscode.workspace.getConfiguration();
  const settings = {
    enabled: cfg.get('focusColorToggle.enabled', true),
    toggleTitleBar: cfg.get('focusColorToggle.toggleTitleBar', true),
    toggleActivityBar: cfg.get('focusColorToggle.toggleActivityBar', true),
    toggleStatusBar: cfg.get('focusColorToggle.toggleStatusBar', true)
  };

  // apply initial state
  if (settings.enabled) {
    applyColors(buildColorsSet(vscode.window.state.focused ? ACTIVE : INACTIVE, settings));
  }

  const sub = vscode.window.onDidChangeWindowState(st => {
    if (!settings.enabled) return;
    applyColors(buildColorsSet(st.focused ? ACTIVE : INACTIVE, settings));
  });
  context.subscriptions.push(sub);

  const disposable = vscode.commands.registerCommand('focusColorToggle.toggle', () => {
    const isFocused = vscode.window.state.focused;
    if (!settings.enabled) {
      vscode.window.showInformationMessage('Focus Color Toggle is disabled in settings');
      return;
    }
    applyColors(buildColorsSet(isFocused ? INACTIVE : ACTIVE, settings));
    vscode.window.showInformationMessage('Toggled focus colors');
  });
  context.subscriptions.push(disposable);
}

exports.activate = activate;
exports.deactivate = () => {};
