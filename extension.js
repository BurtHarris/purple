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

function activate(context) {
  outputHelpers = createOutputHelpers('RiverShade');
  // expose activationContext globally for test helpers that inspect firstInstall
  // (removed - no global export)
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
    rsLog: null
  };

  colors = colorsModule.init(colorRuntime);

  // register only install/remove commands
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.installBling', installBlingCommand));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.removeBling', removeBlingCommand));

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
