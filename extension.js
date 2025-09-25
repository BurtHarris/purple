const vscode = require('vscode');

const ACTIVE = {
  "titleBar.activeBackground": "#49124b",
  "titleBar.activeForeground": "#ffffff",
  "activityBar.background": "#49124b",
  "activityBar.foreground": "#ffffff",
  "statusBar.background": "#49124b",
  "statusBar.foreground": "#ffffff"
};

const INACTIVE = {
  "titleBar.inactiveBackground": "#0f0f0f",
  "titleBar.inactiveForeground": "#e6e6e6",
  "activityBar.inactiveBackground": "#0f0f0f",
  "activityBar.inactiveForeground": "#e6e6e6",
  "statusBar.noFolderBackground": "#0f0f0f",
  "statusBar.noFolderForeground": "#e6e6e6"
};

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
  // apply initial state
  applyColors(vscode.window.state.focused ? ACTIVE : INACTIVE);

  const sub = vscode.window.onDidChangeWindowState(st => {
    applyColors(st.focused ? ACTIVE : INACTIVE);
  });
  context.subscriptions.push(sub);

  const disposable = vscode.commands.registerCommand('focusColorToggle.toggle', () => {
    const isFocused = vscode.window.state.focused;
    applyColors(isFocused ? INACTIVE : ACTIVE);
    vscode.window.showInformationMessage('Toggled focus colors');
  });
  context.subscriptions.push(disposable);
}

exports.activate = activate;
exports.deactivate = () => {};
