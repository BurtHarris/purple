// Install purple bling customizations
async function installBling() {
  try { if (outputChannel) outputChannel.appendLine('RiverShade: Command invoked: rivershade.installBling'); } catch (e) { /* ignore */ }
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
  const cfg = vscode.workspace.getConfiguration();
  const scheme = getColorScheme(cfg);
  const keysToRemove = Object.keys(scheme);

  // Determine targets. For removal we will aggressively clear both Global and Workspace
  // regardless of the user's updateTarget preference so that leftover customizations
  // don't remain in some scopes. We still log the configured preference for clarity.
  const updateTargetSetting = vscode.workspace.getConfiguration().get('focusColorToggle.updateTarget', 'global');
  const configuredTargets = mapUpdateTargetToConfigTargets(updateTargetSetting);
  // Force targets for removal: try Global and Workspace always
  const targets = [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace];

  const updates = [];
  let anyRemoved = false;

  // Use inspect to read values per target so we remove only from that scope
  const inspect = cfg.inspect('workbench.colorCustomizations') || {};

  for (const t of targets) {
    // pick the correct per-target value from inspect; include extra inspect slots
    let currentValue;
    let inspectSource = null;
    if (t === vscode.ConfigurationTarget.Global) {
      if (inspect.globalValue && Object.keys(inspect.globalValue).length) { currentValue = inspect.globalValue; inspectSource = 'globalValue'; }
      else if (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length) { currentValue = inspect.globalLocalValue; inspectSource = 'globalLocalValue'; }
      else { currentValue = inspect.globalValue || inspect.globalLocalValue || {}; }
    } else if (t === vscode.ConfigurationTarget.Workspace) {
      if (inspect.workspaceValue && Object.keys(inspect.workspaceValue).length) { currentValue = inspect.workspaceValue; inspectSource = 'workspaceValue'; }
      else if (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length) { currentValue = inspect.workspaceFolderValue; inspectSource = 'workspaceFolderValue'; }
      else { currentValue = inspect.workspaceValue || inspect.workspaceFolderValue || {}; }
    } else {
      // both: prefer global then workspace
      if (inspect.globalValue && Object.keys(inspect.globalValue).length) { currentValue = inspect.globalValue; inspectSource = 'globalValue'; }
      else if (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length) { currentValue = inspect.globalLocalValue; inspectSource = 'globalLocalValue'; }
      else if (inspect.workspaceValue && Object.keys(inspect.workspaceValue).length) { currentValue = inspect.workspaceValue; inspectSource = 'workspaceValue'; }
      else if (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length) { currentValue = inspect.workspaceFolderValue; inspectSource = 'workspaceFolderValue'; }
      else { currentValue = inspect.globalValue || inspect.workspaceValue || inspect.globalLocalValue || inspect.workspaceFolderValue || {}; }
    }

    if (!currentValue || Object.keys(currentValue).length === 0) {
      // nothing set at this scope
      try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: nothing in target ${t} (inspect source=${inspectSource || '<none>'})`); } catch (e) { /* ignore */ }
      continue;
    }

    // Clone the scope-specific object and remove keys
    const clone = JSON.parse(JSON.stringify(currentValue));
    const theme = getActiveThemeName();
    let changed = false;

    // remove top-level keys
    for (const k of keysToRemove) {
      if (k in clone) {
        delete clone[k];
        changed = true;
      }
    }

    // remove theme-scoped keys
    if (theme) {
      const themeKey = `[${theme}]`;
      if (clone[themeKey]) {
        for (const k of keysToRemove) {
          if (k in clone[themeKey]) {
            delete clone[themeKey][k];
            changed = true;
          }
        }
        // if theme block became empty, remove it
        if (Object.keys(clone[themeKey]).length === 0) delete clone[themeKey];
      }
    }

    if (changed) {
      anyRemoved = true;
      // if clone is empty, pass undefined to remove the setting at that scope
      const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
      updates.push(cfg.update('workbench.colorCustomizations', valueToSet, t));
      try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: scheduled remove in target ${t} (inspect source=${inspectSource || '<none>'})`); } catch (e) { /* ignore */ }
    } else {
      try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: no bling found in target ${t} (inspect source=${inspectSource || '<none>'})`); } catch (e) { /* ignore */ }
    }
  }

  // Additionally attempt to clear per-workspace-folder settings where present. Some
  // users may have folder-scoped colorCustomizations; clear those explicitly.
  const folderUpdates = [];
  try {
    const folders = vscode.workspace.workspaceFolders || [];
    for (const f of folders) {
      try {
        const folderCfg = vscode.workspace.getConfiguration(undefined, f.uri);
        // For folder-scoped configs, it's safest to set undefined which removes the key
        // at that folder scope. We also log what we attempted.
        folderUpdates.push(folderCfg.update('workbench.colorCustomizations', undefined, vscode.ConfigurationTarget.WorkspaceFolder)
          .then(() => {
            try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: cleared workbench.colorCustomizations for workspaceFolder=${f.name}`); } catch (e) { /* ignore */ }
          }).catch(err => {
            try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: failed to clear workspaceFolder=${f.name}: ${err && err.message}`); } catch (e) { /* ignore */ }
          }));
      } catch (e) {
        try { if (outputChannel) outputChannel.appendLine(`RiverShade: removeBling: error preparing folder update for ${f && f.name}: ${e && e.message}`); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore workspaceFolders enumeration errors */ }

  if (updates.length === 0) {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: no bling to remove in any target'); } catch (e) { /* ignore */ }
    try { vscode.window.showInformationMessage('RiverShade: no bling to remove.'); } catch (e) { /* ignore UI errors */ }
    return Promise.resolve(false);
  }

  return Promise.all(updates).then(() => {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling: removed bling in configured targets'); } catch (e) { /* ignore */ }
    try { vscode.window.showInformationMessage('RiverShade: bling removed.'); } catch (e) { /* ignore UI errors */ }
    // Restore previous titleBarStyle if we changed it during applyColors
    try {
      if (activationContext && activationContext.globalState) {
        const prev = activationContext.globalState.get('rivershade.prevTitleBarStyle');
        if (typeof prev === 'string') {
          try {
            vscode.workspace.getConfiguration().update('window.titleBarStyle', prev, vscode.ConfigurationTarget.Global);
            try { if (outputChannel) outputChannel.appendLine('RiverShade: restored previous window.titleBarStyle=' + prev); } catch (e) { /* ignore */ }
          } catch (e) {
            try { if (outputChannel) outputChannel.appendLine('RiverShade: failed to restore previous titleBarStyle: ' + (e && e.message)); } catch (e) { /* ignore */ }
          }
          // clear saved value
          try { activationContext.globalState.update('rivershade.prevTitleBarStyle', undefined); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore restore errors */ }
    return true;
  }).catch(err => {
    try { if (outputChannel) outputChannel.appendLine('RiverShade: removeBling failed: ' + (err && err.message)); } catch (e) { /* ignore */ }
    try { vscode.window.showErrorMessage('RiverShade: failed to remove bling'); } catch (e) { /* ignore UI errors */ }
    return Promise.reject(err);
  });
}
const vscode = require('vscode');


let outputChannel = null;
let extensionMode = null;
let _warnedAboutTitleBarStyle = false;
let activationContext = null; // stored from activate(context) to persist small state like prevTitleBarStyle



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
    // Also log to console so test harness output captures it
    try { console.log('RiverShade: Applying color customizations:', JSON.stringify(merged)); } catch (e) { /* ignore */ }
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
          // Persist the previous value so removeBling can restore it later.
          try {
            if (activationContext && activationContext.globalState) {
              activationContext.globalState.update('rivershade.prevTitleBarStyle', titleBarStyle);
            }
          } catch (e) { /* ignore persistence errors */ }
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
  return Promise.all(updates).then(() => {
    // Post-write verification: inspect the stored colorCustomizations for each target
    try {
      for (const t of targets) {
        const ins = cfg.inspect('workbench.colorCustomizations') || {};
        // pick value from inspect matching the target
        let persisted = null;
        if (t === vscode.ConfigurationTarget.Global) persisted = ins.globalValue || ins.globalLocalValue || {};
        else if (t === vscode.ConfigurationTarget.Workspace) persisted = ins.workspaceValue || ins.workspaceFolderValue || {};
        else persisted = ins.globalValue || ins.workspaceValue || {};

        // Compare requested merged vs persisted to find keys that were ignored
        const requestedKeys = new Set(Object.keys(merged));
        const persistedKeys = new Set(Object.keys(persisted || {}));
        // include theme-specific keys
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
        for (const rk of requestedKeys) {
          if (!persistedKeys.has(rk)) missing.push(rk);
        }
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
        settings: (() => { try { return vscode.workspace.getConfiguration(); } catch (e) { return null; } })()
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
  try { if (outputChannel) outputChannel.appendLine('RiverShade: Command invoked: focusColorToggle.toggle'); } catch (e) { /* ignore */ }
    if (!settings.enabled) {
      vscode.window.showInformationMessage('Focus Color Toggle is disabled in settings');
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
