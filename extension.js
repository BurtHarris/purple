/* eslint-env node */
const vscode = require('vscode');
const colorsModule = require('./lib/colors');

// Centralized output channel and logging helper
function createOutputHelpers(name = 'RiverShade') {
  const channel = vscode.window.createOutputChannel(name);

  function safeAppendLine(...parts) {
    try {
      channel.appendLine(parts.join(' '));
    } catch (e) {
      // ignore
    }
  }

  function timestampedLine(enableTimestamp, ...parts) {
    try {
      if (enableTimestamp) {
        const ts = new Date().toISOString();
        channel.appendLine(ts + ' ' + parts.join(' '));
      } else {
        channel.appendLine(parts.join(' '));
      }
    } catch (e) {
      // ignore
    }
  }

  return {
    outputChannel: channel,
    appendLine: safeAppendLine,
    timestampedLine
  };
}

// Module level state
let _applyColorsImpl = null; // assigned during activate
let colorRuntime = null; // runtime passed to colors module
let outputHelpers = null;
let colors = null;
let extensionMode = null;
let activationContext = null;

function getConfig() {
  const cfg = vscode.workspace.getConfiguration();
  const settings = {
    enabled: cfg.get('focusColorToggle.enabled', cfg.get('riverShade.enabled', true)),
    toggleTitleBar: cfg.get('focusColorToggle.toggleTitleBar', cfg.get('riverShade.toggleTitleBar', true)),
    toggleActivityBar: cfg.get('focusColorToggle.toggleActivityBar', cfg.get('riverShade.toggleActivityBar', true)),
    toggleStatusBar: cfg.get('focusColorToggle.toggleStatusBar', cfg.get('riverShade.toggleStatusBar', true)),
    updateTarget: cfg.get('focusColorToggle.updateTarget', cfg.get('riverShade.updateTarget', 'global')),
    reloadWindowOnChange: cfg.get('focusColorToggle.reloadWindowOnChange', cfg.get('riverShade.reloadWindowOnChange', false)),
    colorScheme: cfg.get('focusColorToggle.colorScheme', cfg.get('riverShade.colorScheme', 'default')),
    requireConfirmation: cfg.get('riverShade.requireConfirmation', true),
    timestampLogs: cfg.get('riverShade.timestampLogs', false)
  };
  return { cfg, settings };
}

function getColorScheme(cfg) {
  try { return (cfg.get('focusColorToggle.colorScheme') || cfg.get('riverShade.colorScheme') || 'default'); } catch (e) { return 'default'; }
}

function getActiveThemeName() {
  try { return vscode.workspace.getConfiguration().get('workbench.colorTheme'); } catch (e) { return undefined; }
}

// Helper: read package.json from disk to avoid require() cache
function readPkg() {
  try {
    const fs = require('fs');
    const path = require('path');
    const pkgPath = path.join(__dirname, 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// Central permission helper. Auto-approves in Test mode or when confirmation disabled.
async function requestPermission(operation, promptText, confirmLabel = 'Yes') {
  try {
    const { settings } = getConfig();
    if (!settings.requireConfirmation || extensionMode === vscode.ExtensionMode.Test) {
      try { outputHelpers && outputHelpers.timestampedLine(settings.timestampLogs, `RiverShade: ${operation}: auto-approved (test mode or confirmation disabled)`); } catch (e) { /* ignore */ }
      return true;
    }
    try {
      const choice = await vscode.window.showWarningMessage(promptText, { modal: true }, confirmLabel, 'Cancel');
      return choice === confirmLabel;
    } catch (e) {
      // If the dialog failed to show, assume approval so non-interactive tests don't block
      return true;
    }
  } catch (e) {
    return false;
  }
}

async function applyColorsImplImpl(colorsToApply) {
  // write to configured scopes: global, workspace or both
  const { cfg, settings } = getConfig();
  const ut = settings.updateTarget || 'global';
  const promises = [];
  try {
    if (ut === 'global' || ut === 'both') promises.push(cfg.update('workbench.colorCustomizations', colorsToApply, vscode.ConfigurationTarget.Global));
    if (ut === 'workspace' || ut === 'both') promises.push(cfg.update('workbench.colorCustomizations', colorsToApply, vscode.ConfigurationTarget.Workspace));
    await Promise.all(promises);
    outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: Applied color customizations:', JSON.stringify(colorsToApply));
    return true;
  } catch (e) {
    outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: Failed to apply colors:', e && e.message ? e.message : String(e));
    throw e;
  }
}

// proxy used by lib/colors to call into extension write logic
async function applyColors(colorsToApply) {
  if (typeof _applyColorsImpl === 'function') return _applyColorsImpl(colorsToApply);
  // if not initialized, still attempt to write directly
  return applyColorsImplImpl(colorsToApply);
}

async function installBlingCommand() {
  const { settings } = getConfig();
  const allowed = await requestPermission('installBling', 'RiverShade: Install color customizations?', 'Install');
  if (!allowed) { outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: User cancelled installBling'); return; }
  try {
    await colors.installBling({});
  } catch (e) {
    outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: installBling error:', e && e.message ? e.message : String(e));
  }
}

async function removeBlingCommand() {
  const { settings } = getConfig();
  const allowed = await requestPermission('removeBling', 'RiverShade: Remove color customizations?', 'Remove');
  if (!allowed) { outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: User cancelled removeBling'); return; }
  try {
    await colors.removeBling();
  } catch (e) {
    outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: removeBling error:', e && e.message ? e.message : String(e));
  }
}

async function toggleCommand() {
  const { cfg, settings } = getConfig();
  if (!settings.enabled) { outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: extension disabled in settings'); return; }
  try {
    const scheme = getColorScheme(cfg);
    const newColors = colorsModule.init({
      vscode, outputChannel: outputHelpers.outputChannel, applyColors: applyColors, getColorScheme, getActiveThemeName, traceLog: null, rsLog: null, activationContext: null
    });
    // build colors inline to avoid race
    const built = newColors.buildColorsSet(scheme, { toggleTitleBar: settings.toggleTitleBar, toggleActivityBar: settings.toggleActivityBar, toggleStatusBar: settings.toggleStatusBar });
    await applyColors(built);
    if (settings.reloadWindowOnChange) {
      try { await vscode.commands.executeCommand('workbench.action.reloadWindow'); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: toggle error:', e && e.message ? e.message : String(e));
  }
}

async function diagnoseCommand() {
  const { settings } = getConfig();
  try {
    const cfg = vscode.workspace.getConfiguration();
    const inspect = cfg.inspect('workbench.colorCustomizations') || {};
    const pkg = readPkg();
    const info = { version: pkg && pkg.version ? pkg.version : null, inspect };
    outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: diagnose inspect:', JSON.stringify(info, null, 2));
    try { vscode.window.showInformationMessage('RiverShade: diagnosis logged to output channel.'); } catch (e) { /* ignore */ }
    return info;
  } catch (e) {
    outputHelpers.timestampedLine(settings.timestampLogs, 'RiverShade: diagnose error:', e && e.message ? e.message : String(e));
  }
}

async function checkInstallCommand() {
  // Dev host only helper to check first-install status
  try {
    const globalState = (global.__rivershade_activation_context__ && global.__rivershade_activation_context__.globalState) || { get: () => undefined };
    const v = globalState.get && globalState.get('rivershade.firstInstall');
    vscode.window.showInformationMessage('RiverShade: firstInstall=' + String(v));
  } catch (e) {
    outputHelpers.timestampedLine(false, 'RiverShade: checkInstall error:', e && e.message ? e.message : String(e));
  }
}

function activate(context) {
  outputHelpers = createOutputHelpers('RiverShade');
  // expose activationContext globally for test helpers that inspect firstInstall
  activationContext = context;
  global.__rivershade_activation_context__ = context;
  extensionMode = context.extensionMode;

  // Set the real applyColors implementation now that outputHelpers is ready
  _applyColorsImpl = applyColorsImplImpl;

  // prepare colors runtime and init colors module
  colorRuntime = {
    vscode,
    outputChannel: outputHelpers.outputChannel,
    applyColors: applyColors,
    getColorScheme,
    getActiveThemeName,
    traceLog: null,
    rsLog: null,
    activationContext: context
  };

  colors = colorsModule.init(colorRuntime);

  // register commands
  context.subscriptions.push(vscode.commands.registerCommand('focusColorToggle.toggle', toggleCommand));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.toggle', toggleCommand));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.installBling', installBlingCommand));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.removeBling', removeBlingCommand));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.diagnose', diagnoseCommand));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.checkInstall', checkInstallCommand));

  // run initial apply if firstInstall flag not set
  try {
    const gs = context.globalState;
    const firstInstall = gs.get('rivershade.firstInstall');
    if (!firstInstall) {
      // mark it
      try { gs.update('rivershade.firstInstall', true); } catch (e) { /* ignore */ }
      // apply on first install
      try {
        const { cfg, settings } = getConfig();
        const scheme = getColorScheme(cfg);
        const built = colors.buildColorsSet(scheme, { toggleTitleBar: settings.toggleTitleBar, toggleActivityBar: settings.toggleActivityBar, toggleStatusBar: settings.toggleStatusBar });
        applyColors(built).catch(() => {});
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
}

function deactivate() {
  // nothing to do
}

module.exports = { activate, deactivate };
