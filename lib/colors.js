/* eslint-env node */
// Color module: encapsulates buildColorsSet, installBling, and removeBling.
// Initialized via init(runtime) where runtime exposes helpers from extension.js
// (vscode, outputChannel, applyColors, getColorScheme, getActiveThemeName,
// traceLog, rsLog, activationContext, and an operationGuard with get/set).

let vscode;
let outputChannel;
let applyColors;
let getColorScheme;
let getActiveThemeName;
let traceLog;
let rsLog;
let activationContext;

function safeLog(...args) {
  try { if (outputChannel) outputChannel.appendLine(args.join(' ')); } catch (e) { /* ignore */ }
}

function buildColorsSet(_scheme, _settings) {
  try {
    const fs = require('fs');
    const path = require('path');
    const colorsPath = path.join(__dirname, '..', 'colors', (_scheme || 'default') + '.json');
    let payload = {};
    if (fs.existsSync(colorsPath)) {
      try { payload = JSON.parse(fs.readFileSync(colorsPath, 'utf8')); } catch (e) { payload = {}; }
    }
    const s = _settings || {};
    const out = {};

    function copyKey(k) { if (payload.hasOwnProperty(k)) out[k] = payload[k]; }

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
  } catch (e) {
    return {};
  }
}

async function installBlingInternal(runtimeCfg) {
  try { safeLog('RiverShade: Command invoked: rivershade.installBling'); } catch (e) { /* ignore */ }
  traceLog && traceLog('installBling invoked');
  rsLog && rsLog('installBling', 'invoked');
  // installBling no longer reserves an operation guard here; caller manages concurrency.
  try {
    const cfg = vscode.workspace.getConfiguration();
    const scheme = getColorScheme(cfg);
    const settings = {
      toggleTitleBar: true,
      toggleActivityBar: true,
      toggleStatusBar: true
    };
    const colors = buildColorsSet(scheme, settings);
    await applyColors(colors);
    safeLog('RiverShade: installBling: applied colors');
    try { vscode.window.showInformationMessage('RiverShade: color customizations installed.'); } catch (e) { /* ignore */ }
  } finally {
    safeLog('RiverShade: installBling: completed');
  }
}

// Remove all bling customizations (extracted from extension.js). Returns a Promise<boolean>
async function removeBlingInternal() {
  safeLog('RiverShade: Command invoked: rivershade.removeBling');
  rsLog && rsLog('removeBling', 'invoked');
  // removeBling: concurrency is managed by the caller; this routine performs removal.
  let cfg;
  let scheme;
  const updates = [];
  const folderUpdates = [];
  try {
    cfg = vscode.workspace.getConfiguration();
    scheme = getColorScheme(cfg);
    const blingPrefixes = ['titleBar.', 'activityBar.', 'statusBar.'];
    const settingsForRemoval = { toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true };
    const exactKeys = Object.keys(buildColorsSet(scheme, settingsForRemoval) || {});
    const targets = [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace];
    const inspect = cfg.inspect('workbench.colorCustomizations') || {};

    for (const t of targets) {
      let currentValue = {};
      let inspectSource = '<none>';
      if (t === vscode.ConfigurationTarget.Global) {
        if (inspect.globalValue && Object.keys(inspect.globalValue).length) { currentValue = inspect.globalValue; inspectSource = 'globalValue'; }
        else if (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length) { currentValue = inspect.globalLocalValue; inspectSource = 'globalLocalValue'; }
        else { currentValue = inspect.globalValue || inspect.globalLocalValue || {}; }
      } else if (t === vscode.ConfigurationTarget.Workspace) {
        if (inspect.workspaceValue && Object.keys(inspect.workspaceValue).length) { currentValue = inspect.workspaceValue; inspectSource = 'workspaceValue'; }
        else if (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length) { currentValue = inspect.workspaceFolderValue; inspectSource = 'workspaceFolderValue'; }
        else { currentValue = inspect.workspaceValue || inspect.workspaceFolderValue || {}; }
      }

      if (!currentValue || Object.keys(currentValue).length === 0) {
        safeLog(`RiverShade: removeBling: nothing in target ${t} (inspect source=${inspectSource})`);
        continue;
      }

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
          for (const k of Object.keys(clone[themeKey])) {
            for (const p of blingPrefixes) {
              if (k.startsWith(p)) { delete clone[themeKey][k]; changed = true; break; }
            }
          }
          if (Object.keys(clone[themeKey]).length === 0) delete clone[themeKey];
        }
      }

      if (changed) {
        const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
        updates.push(cfg.update('workbench.colorCustomizations', valueToSet, t));
        safeLog(`RiverShade: removeBling: scheduled remove in target ${t} (inspect source=${inspectSource})`);
      } else {
        safeLog(`RiverShade: removeBling: no bling found in target ${t} (inspect source=${inspectSource})`);
      }
    }

    try {
      const folders = vscode.workspace.workspaceFolders || [];
      for (const f of folders) {
        try {
          const folderCfg = vscode.workspace.getConfiguration(undefined, f.uri);
          folderUpdates.push(folderCfg.update('workbench.colorCustomizations', undefined, vscode.ConfigurationTarget.WorkspaceFolder)
            .then(() => safeLog(`RiverShade: removeBling: cleared workbench.colorCustomizations for workspaceFolder=${f.name}`))
            .catch(err => {
              const msg = (err && err.message) ? err.message : String(err);
              safeLog(`RiverShade: removeBling: failed to clear workspaceFolder=${f.name}: ${msg}`);
              if (msg && (msg.indexOf('does not support the folder resource scope') !== -1 || msg.indexOf('folder resource scope') !== -1)) {
                safeLog(`RiverShade: removeBling: note: 'workbench.colorCustomizations' does not support folder scope in this environment. To remove folder-scoped color customizations run the bundled script 'scripts\\remove-color-customizations.ps1' or manually edit the '.vscode/settings.json' in the folder ${f.name}.`);
              }
            }));
        } catch (e) { safeLog(`RiverShade: removeBling: error preparing folder update for ${f && f.name}: ${e && e.message}`); }
      }
    } catch (e) { /* ignore */ }

    if (updates.length === 0 && folderUpdates.length === 0) {
      safeLog('RiverShade: removeBling: no bling to remove in any target');
      try { vscode.window.showInformationMessage('RiverShade: no bling to remove.'); } catch (e) { /* ignore UI errors */ }
      return Promise.resolve(false);
    }
  } catch (e) {
    // no guard to clear here; just reject
    safeLog('RiverShade: removeBling setup failed: ' + (e && e.message));
    return Promise.reject(e);
  }

  traceLog && traceLog('removeBling: starting removals');
  return Promise.all(updates).then(async () => {
    safeLog('RiverShade: removeBling: performed scheduled removes');
    try { await Promise.all(folderUpdates); } catch (e) { /* ignore */ }

    try {
      const postInspect = cfg.inspect('workbench.colorCustomizations') || {};
      traceLog && traceLog('removeBling: postInspect', postInspect);
      safeLog('RiverShade: post-remove inspect: ' + JSON.stringify(postInspect, null, 2));
      const remaining = [];
      const scopes = [['globalValue', postInspect.globalValue], ['globalLocalValue', postInspect.globalLocalValue], ['workspaceValue', postInspect.workspaceValue], ['workspaceFolderValue', postInspect.workspaceFolderValue]];
      for (const [name, val] of scopes) {
        if (val && Object.keys(val).length) remaining.push(name + ':' + Object.keys(val).length);
      }
      if (remaining.length) safeLog('RiverShade: post-remove: scopes still containing keys: ' + remaining.join(', '));
      else safeLog('RiverShade: post-remove: no remaining keys found in inspect');
    } catch (e) { safeLog('RiverShade: post-remove inspect failed: ' + (e && e.message)); }

    try {
      if (activationContext && activationContext.globalState) {
        const prev = activationContext.globalState.get('rivershade.prevTitleBarStyle');
        if (typeof prev === 'string') {
          try { vscode.workspace.getConfiguration().update('window.titleBarStyle', prev, vscode.ConfigurationTarget.Global); } catch (e) { safeLog('RiverShade: failed to restore previous titleBarStyle: ' + (e && e.message)); }
          try { activationContext.globalState.update('rivershade.prevTitleBarStyle', undefined); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }

    safeLog('RiverShade: removeBling: removed bling in configured targets');
    try { vscode.window.showInformationMessage('RiverShade: bling removed.'); } catch (e) { /* ignore UI errors */ }

    const RETRY_INTERVAL_MS = 300;
    const RETRY_MAX_MS = 3000;
    const start = Date.now();
    traceLog && traceLog('removeBling: entering verification/retry loop', { start, RETRY_INTERVAL_MS, RETRY_MAX_MS });

    async function checkAndRetry() {
      try {
        const postInspect = cfg.inspect('workbench.colorCustomizations') || {};
        traceLog && traceLog('removeBling: verification inspect', postInspect);
        const scopes = [
          ['globalValue', postInspect.globalValue],
          ['globalLocalValue', postInspect.globalLocalValue],
          ['workspaceValue', postInspect.workspaceValue],
          ['workspaceFolderValue', postInspect.workspaceFolderValue]
        ];
        const remainingScopes = scopes.filter(([, v]) => v && Object.keys(v).length).map(([name]) => name);
        if (remainingScopes.length === 0) {
          traceLog && traceLog('removeBling: verification succeeded, no remaining keys', { elapsed: Date.now() - start });
          safeLog('RiverShade: post-remove: no remaining keys found in inspect');
          safeLog('RiverShade: removeBling: verification succeeded');
          return true;
        }

        if (Date.now() - start > RETRY_MAX_MS) {
          traceLog && traceLog('removeBling: verification timed out, remaining scopes', remainingScopes);
          safeLog('RiverShade: post-remove: scopes still containing keys: ' + remainingScopes.join(', '));
          safeLog('RiverShade: removeBling: verification timed out');
          return false;
        }

        traceLog && traceLog('removeBling: retrying clears for remaining scopes', remainingScopes);
        const retryUpdates = [];
        try {
          const empty = undefined;
          retryUpdates.push(cfg.update('workbench.colorCustomizations', empty, vscode.ConfigurationTarget.Global).catch(() => {}));
          retryUpdates.push(cfg.update('workbench.colorCustomizations', empty, vscode.ConfigurationTarget.Workspace).catch(() => {}));
        } catch (e) { /* ignore */ }

        try {
          const folders = vscode.workspace.workspaceFolders || [];
          for (const f of folders) {
            try {
              const folderCfg = vscode.workspace.getConfiguration(undefined, f.uri);
              retryUpdates.push(folderCfg.update('workbench.colorCustomizations', undefined, vscode.ConfigurationTarget.WorkspaceFolder).catch(() => {}));
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }

        try { await Promise.all(retryUpdates); } catch (e) { /* ignore */ }
        await new Promise(r => setTimeout(r, RETRY_INTERVAL_MS));
        return checkAndRetry();
      } catch (e) {
        traceLog && traceLog('removeBling: verification loop error', e && e.message);
        safeLog('RiverShade: removeBling: verification failed: ' + (e && e.message));
        return false;
      }
    }

    return checkAndRetry();
  }).catch(err => {
    safeLog('RiverShade: removeBling failed: ' + (err && err.message));
    try { vscode.window.showErrorMessage('RiverShade: failed to remove bling'); } catch (e) { /* ignore UI errors */ }
    traceLog && traceLog('removeBling: failed', { err: (err && err.message) });
    return Promise.reject(err);
  });
}

function init(runtime) {
  vscode = runtime.vscode;
  outputChannel = runtime.outputChannel;
  applyColors = runtime.applyColors;
  getColorScheme = runtime.getColorScheme;
  getActiveThemeName = runtime.getActiveThemeName;
  traceLog = runtime.traceLog;
  rsLog = runtime.rsLog;
  activationContext = runtime.activationContext;
  // This module no longer uses an injected operationGuard; concurrency should be
  // managed by the caller (extension.js)
  return {
    buildColorsSet,
    installBling: installBlingInternal,
    removeBling: removeBlingInternal
  };
}

module.exports = { init };
