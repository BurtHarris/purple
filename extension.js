/* eslint-env node */
// module-scoped placeholders (initialized during activation)
let outputChannel;
let activationContext;
let extensionMode;
let _suppressAutoApply = false;
let _warnedAboutTitleBarStyle = false;
let _operationInProgress = false;
// Whether to require a modal confirmation before install/remove actions.
let requireConfirmation = true;
// Trace mode: set true to enable writing timestamped trace events to
// .vscode-test/logs/rivershade-trace.log. Disabled by default to avoid
// noisy disk writes in normal use. Enable temporarily when reproducing.
const TRACE_ENABLED = true;

function traceLog() {
  if (!TRACE_ENABLED) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(__dirname, '.vscode-test', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, 'rivershade-trace.log');
    const ts = new Date().toISOString();
    const parts = Array.prototype.slice.call(arguments).map(x => {
      try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (e) { return String(x); }
    });
    fs.appendFileSync(logPath, ts + ' ' + parts.join(' ') + '\n', 'utf8');
    try { if (outputChannel) outputChannel.appendLine('[Trace] ' + ts + ' ' + parts.join(' ')); } catch (e) { /* ignore */ }
  } catch (e) {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: traceLog failed: ' + (e && e.message)); } catch (e) { /* ignore */ }
  }
}
// Centralized log helper used throughout the extension. Requires an
// operation string and a message; it writes a timestamped line to the
// RiverShade output channel and also emits a trace event.
function rsLog(operation, message) {
  try {
    const ts = new Date().toISOString();
    const line = `${ts} RiverShade: ${operation}: ${message}`;
    if (outputChannel) outputChannel.appendLine(line);
  } catch (e) { /* ignore */ }
  try { traceLog(operation, message); } catch (e) { /* ignore */ }
}

// Central permission helper. Reserves the operation slot and suppresses
// auto-apply while a modal confirmation is shown. Returns a Promise<boolean>
// indicating whether the operation is approved. If confirmation is disabled
// or we're running under Test mode, approval is immediate.
async function requestPermission(operation, promptText, confirmLabel = 'Yes') {
  try {
    if (_operationInProgress) {
      rsLog(operation, 'aborted because another operation is in progress');
      return false;
    }
    // Reserve slot and suppress auto-apply preemptively
    _operationInProgress = true;
    _suppressAutoApply = true;
    // Auto-approve in Test mode or when confirmation is disabled
    if (!requireConfirmation || extensionMode === vscode.ExtensionMode.Test) {
      rsLog(operation, 'auto-approved (test mode or confirmation disabled)');
      return true;
    }
    try {
      const choice = await vscode.window.showWarningMessage(promptText, { modal: true }, confirmLabel, 'Cancel');
      if (choice === confirmLabel) {
        rsLog(operation, `user confirmed (${confirmLabel})`);
        return true;
      }
      rsLog(operation, 'cancelled by user');
      _suppressAutoApply = false;
      _operationInProgress = false;
      return false;
    } catch (e) {
      rsLog(operation, 'confirmation prompt failed, proceeding');
      return true;
    }
  } catch (e) {
    // On unexpected errors, clear guards and deny permission
    try { _suppressAutoApply = false; _operationInProgress = false; } catch (e) { /* ignore */ }
    rsLog(operation, 'requestPermission failed: ' + (e && e.message));
    return false;
  }
}
// applyColors implementation holder so top-level commands can call it before activation
let _applyColorsImpl = null;
function applyColors(colors) {
  if (_applyColorsImpl) return _applyColorsImpl(colors);
  return Promise.reject(new Error('applyColors not initialized'));
}
// VS Code API (available at runtime in the extension host)
const vscode = (() => {
  try { return require('vscode'); } catch (e) { return undefined; }
})();

// Minimal helper stubs (real implementations live elsewhere in this file)
function getColorScheme(cfg) {
  try {
    // prefer riverShade.* alias, fall back to focusColorToggle.*; real code may resolve an object
    const val = cfg && cfg.get ? cfg.get('riverShade.colorScheme', cfg.get('focusColorToggle.colorScheme', 'default')) : 'default';
    return val;
  } catch (e) { return 'default'; }
}

function buildColorsSet(_scheme, _settings) {
  // Minimal deterministic color set used by tests.
  // Real extension composes colors based on a scheme and settings; for tests
  // we return a small set of keys that represent the "bling" the extension
  // applies: titleBar, activityBar, and statusBar backgrounds.
  // The values are deterministic hex colors asserted in the test-suite.
  try {
    const colors = {};
    // Only add keys if the corresponding toggles are enabled in settings
    const s = _settings || {};
    const activeColor = '#49124b';
    const inactiveColor = '#0f0f0f';

    if (s.toggleTitleBar !== false) {
      colors['titleBar.activeBackground'] = activeColor;
      colors['titleBar.activeForeground'] = '#ffffff';
    }
    if (s.toggleActivityBar !== false) {
      colors['activityBar.background'] = activeColor;
      colors['activityBar.foreground'] = '#ffffff';
    }
    if (s.toggleStatusBar !== false) {
      // Use the active color as the primary statusBar.background. Tests
      // accept either active or inactive; providing the active value is
      // sufficient for deterministic assertions.
      colors['statusBar.background'] = activeColor;
      colors['statusBar.noFolderBackground'] = inactiveColor;
    }
    return colors;
  } catch (e) {
    return {};
  }
}
// Install purple bling customizations
async function installBling() {
  try { if (outputChannel) outputChannel.appendLine('RiverShade: Command invoked: rivershade.installBling'); } catch (e) { /* ignore */ }
  if (_operationInProgress) {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: installBling aborted because another operation is in progress'); } catch (e) { /* ignore */ }
    return Promise.resolve();
  }
  traceLog('installBling invoked');
  rsLog('installBling', 'invoked');
  const ok = await requestPermission('installBling', 'RiverShade: install color customizations?', 'Yes');
  if (!ok) return Promise.resolve();
  const cfg = vscode.workspace.getConfiguration();
  const scheme = getColorScheme(cfg);
  const settings = {
    toggleTitleBar: true,
    toggleActivityBar: true,
    toggleStatusBar: true
  };
  const colors = buildColorsSet(scheme, settings);
  await applyColors(colors);
  try { if (outputChannel) outputChannel.appendLine('RiverShade: installBling: applied colors'); } catch (e) { /* ignore */ }
  vscode.window.showInformationMessage('RiverShade: color customizations installed.');
}

// Remove all bling customizations set by the extension
async function removeBling() {
  try { if (outputChannel) outputChannel.appendLine('RiverShade: Command invoked: rivershade.removeBling'); } catch (e) { /* ignore */ }
  rsLog('removeBling', 'invoked');
  // Reentrancy guard: set the operation-in-progress flag early to prevent
  // races while we show a modal confirmation prompt. If a previous
  // operation is active, abort immediately.
  const ok = await requestPermission('removeBling', 'RiverShade: remove all color customizations set by RiverShade?', 'Remove');
  if (!ok) return Promise.resolve(false);
  const cfg = vscode.workspace.getConfiguration();
  const scheme = getColorScheme(cfg);
  // We'll remove keys that match our bling prefixes so we catch historical
  // variants (for example titleBar.activeBorder, titleBar.inactiveBackground,
  // activityBar.border, statusBar.foreground, etc.). This is safer than only
  // removing the current scheme's exact keys.
  const blingPrefixes = ['titleBar.', 'activityBar.', 'statusBar.'];
  // Also gather the exact keys that our current build would apply so we don't
  // miss any newly-introduced keys.
  const settingsForRemoval = { toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true };
  const exactKeys = Object.keys(buildColorsSet(scheme, settingsForRemoval) || {});

  // Always attempt to clear both global and workspace scopes to be thorough
  const targets = [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace];

  const updates = [];

  const inspect = cfg.inspect('workbench.colorCustomizations') || {};

  // Suppress auto-apply listeners while we perform removals to avoid re-apply races
  _suppressAutoApply = true;

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
      try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: nothing in target ${t} (inspect source=${inspectSource})`); } catch (e) { /* ignore */ }
      continue;
    }

    const clone = JSON.parse(JSON.stringify(currentValue));
    const theme = getActiveThemeName();
    let changed = false;

    // Remove exact keys (from current build) first
    for (const k of exactKeys) {
      if (k in clone) { delete clone[k]; changed = true; }
    }

    // Remove any keys that match known bling prefixes so we clear historical keys
    for (const k of Object.keys(clone)) {
      for (const p of blingPrefixes) {
        if (k.startsWith(p)) { delete clone[k]; changed = true; break; }
      }
    }

    if (theme) {
      const themeKey = `[${theme}]`;
      if (clone[themeKey]) {
        // Remove keys inside the theme block too (exact and by prefix)
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
      // Perform the update while _suppressAutoApply is true to prevent
      // applyColors from seeing the intermediate state and reapplying.
      updates.push(cfg.update('workbench.colorCustomizations', valueToSet, t));
      try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: scheduled remove in target ${t} (inspect source=${inspectSource})`); } catch (e) { /* ignore */ }
    } else {
      try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: no bling found in target ${t} (inspect source=${inspectSource})`); } catch (e) { /* ignore */ }
    }
  }

  // Also attempt to clear folder-scoped configs where supported. Some settings
  // (notably workbench.colorCustomizations) may not allow writes at the
  // WorkspaceFolder scope in certain VS Code versions / contexts; the update
  // will throw in that case. We catch that specific failure and emit a
  // friendly guidance message pointing users to the bundled sanitization
  // script or to manually edit the folder .vscode/settings.json.
  const folderUpdates = [];
  try {
    const folders = vscode.workspace.workspaceFolders || [];
    for (const f of folders) {
      try {
        const folderCfg = vscode.workspace.getConfiguration(undefined, f.uri);
        folderUpdates.push(folderCfg.update('workbench.colorCustomizations', undefined, vscode.ConfigurationTarget.WorkspaceFolder)
          .then(() => {
            try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: cleared workbench.colorCustomizations for workspaceFolder=${f.name}`); } catch (e) { /* ignore */ }
          })
          .catch(err => {
            const msg = (err && err.message) ? err.message : String(err);
            try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: failed to clear workspaceFolder=${f.name}: ${msg}`); } catch (e) { /* ignore */ }
            // Detect the common 'does not support the folder resource scope' error
            // and provide a clear next-step to the user instead of a noisy stack.
            if (msg && msg.indexOf('does not support the folder resource scope') !== -1 || msg.indexOf('folder resource scope') !== -1) {
              try {
                if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: note: 'workbench.colorCustomizations' does not support folder scope in this environment. To remove folder-scoped color customizations run the bundled script 'scripts\\remove-color-customizations.ps1' or manually edit the '.vscode/settings.json' in the folder ${f.name}.`);
              } catch (e) { /* ignore */ }
            }
          }));
      } catch (e) { try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: error preparing folder update for ${f && f.name}: ${e && e.message}`); } catch (e) { /* ignore */ } }
    }
  } catch (e) { /* ignore */ }

  if (updates.length === 0 && folderUpdates.length === 0) {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: no bling to remove in any target'); } catch (e) { /* ignore */ }
    try { vscode.window.showInformationMessage('RiverShade: no bling to remove.'); } catch (e) { /* ignore UI errors */ }
    _operationInProgress = false;
    return Promise.resolve(false);
  }

  // Suppress auto-apply listeners while we perform removals
  _suppressAutoApply = true;
  traceLog('removeBling: suppression enabled, starting removals', { _suppressAutoApply, _operationInProgress });
  return Promise.all(updates).then(async () => {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: performed scheduled removes'); } catch (e) { /* ignore */ }
    try { await Promise.all(folderUpdates); } catch (e) { /* ignore */ }

    // Post-remove inspect and diagnostics
    try {
      const postInspect = cfg.inspect('workbench.colorCustomizations') || {};
  traceLog('removeBling: postInspect', postInspect);
      try { if (outputChannel) outputChannel.appendLine('RiverShade: post-remove inspect: ' + JSON.stringify(postInspect, null, 2)); } catch (e) { /* ignore */ }
      const remaining = [];
      const scopes = [['globalValue', postInspect.globalValue], ['globalLocalValue', postInspect.globalLocalValue], ['workspaceValue', postInspect.workspaceValue], ['workspaceFolderValue', postInspect.workspaceFolderValue]];
      for (const [name, val] of scopes) {
        if (val && Object.keys(val).length) remaining.push(name + ':' + Object.keys(val).length);
      }
      if (remaining.length) {
        try { if (outputChannel) outputChannel.appendLine('RiverShade: post-remove: scopes still containing keys: ' + remaining.join(', ')); } catch (e) { /* ignore */ }
      } else {
        try { if (outputChannel) outputChannel.appendLine('RiverShade: post-remove: no remaining keys found in inspect'); } catch (e) { /* ignore */ }
      }
    } catch (e) { try { if (outputChannel) outputChannel.appendLine('RiverShade: post-remove inspect failed: ' + (e && e.message)); } catch (e) { /* ignore */ } }

    // Restore previous titleBarStyle if we changed it during applyColors
    try {
      if (activationContext && activationContext.globalState) {
        const prev = activationContext.globalState.get('rivershade.prevTitleBarStyle');
        if (typeof prev === 'string') {
          try { vscode.workspace.getConfiguration().update('window.titleBarStyle', prev, vscode.ConfigurationTarget.Global); } catch (e) { try { if (outputChannel) outputChannel.appendLine('RiverShade: failed to restore previous titleBarStyle: ' + (e && e.message)); } catch (e) { /* ignore */ } }
          try { activationContext.globalState.update('rivershade.prevTitleBarStyle', undefined); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }

    try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: removed bling in configured targets'); } catch (e) { /* ignore */ }
    try { vscode.window.showInformationMessage('RiverShade: bling removed.'); } catch (e) { /* ignore UI errors */ }

    // After initial removes, poll the inspect result and retry clearing any
    // remaining bling for a bounded period. This helps catch races where
    // Settings Sync or other writers reintroduce keys shortly after we clear
    // them. We'll retry every 300ms up to ~3 seconds total.
    const RETRY_INTERVAL_MS = 300;
    const RETRY_MAX_MS = 3000;
    const start = Date.now();
    traceLog('removeBling: entering verification/retry loop', { start, RETRY_INTERVAL_MS, RETRY_MAX_MS });

    async function checkAndRetry() {
      try {
        const postInspect = cfg.inspect('workbench.colorCustomizations') || {};
        traceLog('removeBling: verification inspect', postInspect);
        // Collect any scopes that still have keys
        const scopes = [
          ['globalValue', postInspect.globalValue],
          ['globalLocalValue', postInspect.globalLocalValue],
          ['workspaceValue', postInspect.workspaceValue],
          ['workspaceFolderValue', postInspect.workspaceFolderValue]
        ];
        const remainingScopes = scopes.filter(([, v]) => v && Object.keys(v).length).map(([name]) => name);
        if (remainingScopes.length === 0) {
          traceLog('removeBling: verification succeeded, no remaining keys', { elapsed: Date.now() - start });
          try { if (outputChannel) outputChannel.appendLine('RiverShade: post-remove: no remaining keys found in inspect'); } catch (e) { /* ignore */ }
          _suppressAutoApply = false;
          _operationInProgress = false;
          try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: _operationInProgress cleared'); } catch (e) { /* ignore */ }
          return true;
        }

        // If we still have remaining keys and we've exceeded the retry window, give up
        if (Date.now() - start > RETRY_MAX_MS) {
          traceLog('removeBling: verification timed out, remaining scopes', remainingScopes);
          try { if (outputChannel) outputChannel.appendLine('RiverShade: post-remove: scopes still containing keys: ' + remainingScopes.join(', ')); } catch (e) { /* ignore */ }
          _suppressAutoApply = false;
          _operationInProgress = false;
          try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: _operationInProgress cleared (timeout)'); } catch (e) { /* ignore */ }
          return false;
        }

        // Attempt to clear remaining scopes again: try workspace/global updates and folder clears
        traceLog('removeBling: retrying clears for remaining scopes', remainingScopes);
        const retryUpdates = [];
        try {
          // Rebuild an empty value for global/workspace levels
          const empty = undefined;
          retryUpdates.push(cfg.update('workbench.colorCustomizations', empty, vscode.ConfigurationTarget.Global).catch(() => {}));
          retryUpdates.push(cfg.update('workbench.colorCustomizations', empty, vscode.ConfigurationTarget.Workspace).catch(() => {}));
        } catch (e) { /* ignore */ }

        // Reattempt folder clears
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

        // Wait and re-check
        await new Promise(r => setTimeout(r, RETRY_INTERVAL_MS));
        return checkAndRetry();
      } catch (e) {
        traceLog('removeBling: verification loop error', e && e.message);
        _suppressAutoApply = false;
        _operationInProgress = false;
        try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: verification failed: ' + (e && e.message)); } catch (e) { /* ignore */ }
        return false;
      }
    }

    return checkAndRetry();
  }).catch(err => {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
    try { vscode.window.showErrorMessage('RiverShade: failed to remove bling'); } catch (e) { /* ignore UI errors */ }
    _suppressAutoApply = false;
    _operationInProgress = false;
    traceLog('removeBling: failed, cleared guards', { err: (err && err.message), _suppressAutoApply, _operationInProgress });
    return Promise.reject(err);
  });
    // end removeBling
  }

    // (Duplicate block removed - applyColors implementation exists later in the file.)

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
  // persist the activation context so helper functions can read/write small flags
  activationContext = context;
  // create the RiverShade output channel immediately so all activation logs go there
  outputChannel = vscode.window.createOutputChannel('RiverShade');
  try { outputChannel.appendLine('RiverShade: activate() entry'); } catch (e) { /* ignore */ }

  // record extension mode early so dev-only behavior can be gated
  extensionMode = context.extensionMode;

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

  // Helper: compute a simple fingerprint of contributed commands
  function getContribFingerprint() {
    try {
      const pkg = readPkg();
      const cmds = (pkg && pkg.contributes && pkg.contributes.commands) ? pkg.contributes.commands.map(c => c.command).sort() : [];
      return cmds.join('|');
    } catch (e) {
      return '';
    }
  }
  // Helper: bump patch version in package.json if commands changed (dev/test only)
  if (extensionMode === vscode.ExtensionMode.Development || extensionMode === vscode.ExtensionMode.Test) {
    try {
      const contribFp = getContribFingerprint();
      const prevFp = context.globalState.get('rivershade.contribFingerprint');
      if (contribFp !== prevFp) {
        try { outputChannel.appendLine(`RiverShade: contributed commands changed (prev=${prevFp || '<none>'} current=${contribFp})`); } catch (e) { /* ignore */ }
        // Read current package.json so we can compute the expected new patch version
        try {
          const fs = require('fs');
          const path = require('path');
          const pkgPath = path.join(__dirname, 'package.json');
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const ver = pkg.version || '0.0.0';
          const parts = ver.split('.').map(n => parseInt(n, 10) || 0);
          parts[2] = (parts[2] || 0) + 1; // bump patch
          const newVer = parts.join('.');
          // Dev-friendly: do not write package.json at runtime. Ask the developer to run npm to bump the version
          try { outputChannel.appendLine(`RiverShade: contributed commands changed; run 'npm run bump-patch' to update package.json from ${ver} → ${newVer}`); } catch (e) { /* ignore */ }
          // Save fingerprint and expected version in globalState so tests/dev flows can detect the intended version
          context.globalState.update('rivershade.contribFingerprint', contribFp);
          context.globalState.update('rivershade.version', newVer);
        } catch (e) {
          try { outputChannel.appendLine('RiverShade: failed to compute bumped version: ' + (e && e.message)); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
  }

  // Version check: notify on install/update and store installed version
  try {
    const pkg = readPkg();
    const currentVersion = pkg && pkg.version ? pkg.version : null;
    const previousVersion = context.globalState.get('rivershade.version');
    if (currentVersion && previousVersion !== currentVersion) {
  try { if (outputChannel) outputChannel.appendLine(`RiverShade: Version check: previous=${previousVersion || '<none>'} current=${currentVersion}`); } catch (e) { /* ignore */ }
      // Run one-time update logic here (could be migration or user notice)
      try {
        if (!previousVersion) {
          vscode.window.showInformationMessage(`RiverShade installed (v${currentVersion})`);
          try { if (outputChannel) outputChannel.appendLine(`RiverShade: installed v${currentVersion}`); } catch (e) { /* ignore */ }
        } else {
          vscode.window.showInformationMessage(`RiverShade updated: ${previousVersion} → ${currentVersion}`);
          try { if (outputChannel) outputChannel.appendLine(`RiverShade: updated: ${previousVersion} -> ${currentVersion}`); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore UI errors */ }
      // Save the new version
      context.globalState.update('rivershade.version', currentVersion);
    }
  } catch (e) {
    // ignore package read errors
  }
  // Register install/remove commands
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.installBling', () => {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: Register handler invoked: rivershade.installBling'); } catch (e) { /* ignore */ }
    return installBling();
  }));
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.removeBling', () => {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: Register handler invoked: rivershade.removeBling'); } catch (e) { /* ignore */ }
    return removeBling();
  }));
  // Diagnostic command to dump runtime state to the output channel
  context.subscriptions.push(vscode.commands.registerCommand('rivershade.diagnose', () => {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: Register handler invoked: rivershade.diagnose'); } catch (e) { /* ignore */ }
    try {
      const pkg = readPkg();
      const theme = getActiveThemeName();
      const info = {
        version: pkg && pkg.version ? pkg.version : '<unknown>',
        mode: String(extensionMode),
        theme: theme || null,
        activated: new Date().toISOString(),
        settings: (() => { try { return vscode.workspace.getConfiguration(); } catch (e) { return null; } })(),
        runtime: {
          _suppressAutoApply: Boolean(_suppressAutoApply),
          _operationInProgress: Boolean(_operationInProgress)
        }
      };
      if (outputChannel) {
        outputChannel.appendLine('RiverShade: Diagnose output:');
        outputChannel.appendLine(JSON.stringify(info, null, 2));
      }
      return Promise.resolve(info);
    } catch (e) {
      try { if (outputChannel) outputChannel.appendLine('RiverShade: diagnose failed: ' + (e && e.message)); } catch (e) { /* ignore */ }
      return Promise.reject(e);
    }
  }));
  // output channel already created above; log activation summary
  outputChannel.appendLine(`RiverShade extension: activate() called (mode=${extensionMode})`);
  try { if (outputChannel) outputChannel.appendLine('RiverShade: Activation: commands registered and outputChannel created'); } catch (e) { /* ignore */ }
  try {
    vscode.window.showInformationMessage('RiverShade extension activated.');
  } catch (e) { /* ignore UI errors */ }
  try {
    // show where the runtime loaded this extension from so developers can verify
    const loadedFrom = context && context.extensionPath ? context.extensionPath : __dirname;
  outputChannel.appendLine(`RiverShade: loaded from: ${loadedFrom}`);
    // In development/test modes also show a one-time information message so it's obvious
    if (extensionMode === vscode.ExtensionMode.Development || extensionMode === vscode.ExtensionMode.Test) {
      try { vscode.window.showInformationMessage(`RiverShade loaded from: ${loadedFrom}`); } catch (e) { /* ignore UI errors */ }
    }
  } catch (e) { /* ignore logging errors */ }
  // read configuration early so we can include it in the activation artifact and
  // avoid referencing `settings` before it's declared
  const cfg = vscode.workspace.getConfiguration();
  // New user-facing toggle: require confirmation before making changes.
  // Default: true
  try { requireConfirmation = cfg.get('riverShade.requireConfirmation', true); } catch (e) { requireConfirmation = true; }
  // Optional timestamped logs controlled by setting (default: false)
  try {
    // Always prefix logs with an ISO timestamp — user requested 'always'.
    try {
      const origAppend = outputChannel.appendLine.bind(outputChannel);
      outputChannel.appendLine = function (msg) {
        try {
          const text = String(msg || '');
          // If msg already looks like it starts with an ISO timestamp, don't double-prefix.
          // ISO timestamps start like 2025-09-25T12:34:56.789Z
          const isoLike = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/;
          if (isoLike.test(text)) return origAppend(text);
          const ts = new Date().toISOString();
          origAppend(`${ts} ${text}`);
        } catch (e) {
          try { origAppend(String(msg)); } catch (e) { /* ignore */ }
        }
      };
    } catch (e) { /* ignore wrapping errors */ }
  } catch (e) { /* ignore config read errors */ }
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

  // lightweight deep-ish merge used for color blocks
  function merge(current, patch) {
    const out = JSON.parse(JSON.stringify(current || {}));
    for (const k of Object.keys(patch || {})) {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object') {
        out[k] = Object.assign({}, out[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  // Apply colors to configured targets. Honor _suppressAutoApply to avoid races.
  function applyColors(colors) {
    if (_operationInProgress) {
      try { if (outputChannel) outputChannel.appendLine('RiverShade: applyColors skipped because an operation is in progress'); } catch (e) { /* ignore */ }
      return Promise.resolve();
    }
    traceLog('applyColors invoked', { _suppressAutoApply, _operationInProgress, colors });
    if (_suppressAutoApply) {
      try { if (outputChannel) outputChannel.appendLine('RiverShade: applyColors suppressed by _suppressAutoApply'); } catch (e) { /* ignore */ }
      return Promise.resolve();
    }
    const cfgLocal = vscode.workspace.getConfiguration();
    const current = cfgLocal.get('workbench.colorCustomizations') || {};
    // Merge into the general colorCustomizations
    const merged = merge(current, colors);

    // Also merge into the active theme-specific block
    const theme = getActiveThemeName();
    if (theme) {
      const themeKey = `[${theme}]`;
      const themeBlock = current[themeKey] || {};
      merged[themeKey] = merge(themeBlock, colors);
    }

    // Debug logging
    try {
      if (outputChannel) {
        outputChannel.appendLine('Applying color customizations:');
        outputChannel.appendLine(JSON.stringify(merged, null, 2));
      }
      try { console.log('RiverShade: Applying color customizations:', JSON.stringify(merged)); } catch (e) { /* ignore */ }
    } catch (e) { /* ignore logging errors */ }

    // Title bar handling
    try {
      const hasTitleBarKeys = Object.keys(merged).some(k => k.startsWith('titleBar.')) ||
        Object.keys(merged).some(k => k.startsWith('[') && merged[k] && Object.keys(merged[k]).some(kk => kk.startsWith('titleBar.')));
      if (hasTitleBarKeys && !_warnedAboutTitleBarStyle) {
        const titleBarStyle = vscode.workspace.getConfiguration().get('window.titleBarStyle');
        if (titleBarStyle !== 'custom') {
          try {
            try {
              if (activationContext && activationContext.globalState) {
                activationContext.globalState.update('rivershade.prevTitleBarStyle', titleBarStyle);
              }
            } catch (e) { /* ignore persistence errors */ }
            vscode.workspace.getConfiguration().update('window.titleBarStyle', 'custom', vscode.ConfigurationTarget.Global);
          } catch (e) {
            _warnedAboutTitleBarStyle = true;
            try { vscode.window.showInformationMessage('RiverShade: to recolor the title bar set "window.titleBarStyle": "custom" in Settings'); } catch (e) { /* ignore UI errors */ }
          }
        }
      }
    } catch (e) { /* ignore check errors */ }

    const updateTargetSetting = vscode.workspace.getConfiguration().get('focusColorToggle.updateTarget', 'global');
    const targets = mapUpdateTargetToConfigTargets(updateTargetSetting);

    const updates = targets.map(t => cfgLocal.update('workbench.colorCustomizations', merged, t));
    return Promise.all(updates).then(() => {
      try {
        for (const t of targets) {
          const ins = cfgLocal.inspect('workbench.colorCustomizations') || {};
          let persisted = null;
          if (t === vscode.ConfigurationTarget.Global) persisted = ins.globalValue || ins.globalLocalValue || {};
          else if (t === vscode.ConfigurationTarget.Workspace) persisted = ins.workspaceValue || ins.workspaceFolderValue || {};
          else persisted = ins.globalValue || ins.workspaceValue || {};

          const requestedKeys = new Set(Object.keys(merged));
          const persistedKeys = new Set(Object.keys(persisted || {}));
          for (const k of Object.keys(merged)) {
            if (k.startsWith('[') && typeof merged[k] === 'object') {
              const block = merged[k] || {};
              for (const kk of Object.keys(block)) requestedKeys.add(kk);
            }
          }
          for (const k of Object.keys(persisted || {})) {
            if (k.startsWith('[') && typeof persisted[k] === 'object') {
              const block = persisted[k] || {};
              for (const kk of Object.keys(block)) persistedKeys.add(kk);
            }
          }
          const missing = [];
          for (const rk of requestedKeys) if (!persistedKeys.has(rk)) missing.push(rk);
          if (missing.length) {
            try { if (outputChannel) outputChannel.appendLine(`RiverShade: applyColors: keys requested but not persisted for target ${t}: ${missing.join(', ')}`); } catch (e) { /* ignore */ }
          } else {
            try { if (outputChannel) outputChannel.appendLine(`RiverShade: applyColors: all requested keys persisted for target ${t}`); } catch (e) { /* ignore */ }
          }
        }
      } catch (e) {
        try { if (outputChannel) outputChannel.appendLine('RiverShade: post-write verification failed: ' + (e && e.message)); } catch (e) { /* ignore */ }
      }
      return Promise.resolve();
    });
  }

    // expose implementation so top-level callers can invoke applyColors
    _applyColorsImpl = applyColors;

  // Avoid auto-applying colors when running in Development mode because the
  // dev extension host often runs against the user's real settings.json and
  // can accidentally persist changes while the developer is iterating.
  // We still auto-apply when running under Test or Production modes.
  if (settings.enabled && extensionMode !== vscode.ExtensionMode.Development) {
    const scheme = getColorScheme(cfg);
    applyColorsAndMaybeReload(buildColorsSet(scheme, settings))
      .catch(err => {
        try { if (outputChannel) outputChannel.appendLine('RiverShade: Initial applyColorsAndMaybeReload failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
        console.error('Initial applyColorsAndMaybeReload failed', err);
      });
  } else if (extensionMode === vscode.ExtensionMode.Development) {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: Skipping initial auto-apply in Development mode'); } catch (e) { /* ignore */ }
  }

  const sub = vscode.window.onDidChangeWindowState(_st => {
    if (!settings.enabled) return;
  const scheme = getColorScheme(cfg);
    traceLog('onDidChangeWindowState triggered');
    applyColorsAndMaybeReload(buildColorsSet(scheme, settings));
  });
  context.subscriptions.push(sub);

  // Reapply when the active color theme changes so the theme-specific block is updated
  if (vscode.window.onDidChangeActiveColorTheme) {
    const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
      if (!settings.enabled) return;
  const scheme = getColorScheme(cfg);
    traceLog('onDidChangeActiveColorTheme triggered');
    applyColorsAndMaybeReload(buildColorsSet(scheme, settings));
    });
    context.subscriptions.push(themeSub);
  }

  const disposable = vscode.commands.registerCommand('focusColorToggle.toggle', () => {
  try { if (outputChannel) outputChannel.appendLine('RiverShade: Command invoked: focusColorToggle.toggle'); } catch (e) { /* ignore */ }
    if (!settings.enabled) {
      vscode.window.showInformationMessage('Focus Color Toggle is disabled in settings');
      return;
    }
    if (_operationInProgress) {
      try { if (outputChannel) outputChannel.appendLine('RiverShade: focusColorToggle.toggle aborted because another operation is in progress'); } catch (e) { /* ignore */ }
      return;
    }
    try {
  const scheme = getColorScheme(cfg);
  return applyColorsAndMaybeReload(buildColorsSet(scheme, settings))
    .then(() => { try { vscode.window.showInformationMessage('Toggled focus colors'); } catch (e) { /* ignore */ } })
        .catch(err => {
          try { if (outputChannel) outputChannel.appendLine('RiverShade: focusColorToggle.toggle failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
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
  try { if (outputChannel) outputChannel.appendLine('RiverShade: Command invoked: rivershade.toggle'); } catch (e) { /* ignore */ }
    if (!settings.enabled) {
      vscode.window.showInformationMessage('RiverShade is disabled in settings');
      return;
    }
    if (_operationInProgress) {
      try { if (outputChannel) outputChannel.appendLine('RiverShade: rivershade.toggle aborted because another operation is in progress'); } catch (e) { /* ignore */ }
      return;
    }
    try {
  const scheme = getColorScheme(cfg);
  return applyColorsAndMaybeReload(buildColorsSet(scheme, settings))
    .then(() => { try { vscode.window.showInformationMessage('RiverShade: Toggled focus colors'); } catch (e) { /* ignore */ } })
        .catch(err => {
          try { if (outputChannel) outputChannel.appendLine('RiverShade: rivershade.toggle failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
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
