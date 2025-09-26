/* lib/colorPicker.js
   Clean, single implementation for the color picker webview.
*/
const fs = require('fs');
const path = require('path');
const helpers = require('./colorHelpers');

function loadBundledHtml(context) {
  const mediaPath = path.join(context.extensionPath || __dirname, 'media', 'palette-preview.html');
  if (!fs.existsSync(mediaPath)) return null;
  return fs.readFileSync(mediaPath, 'utf8');
}

function openColorPicker(context, deps = {}) {
  const vscode = deps.vscode;
  if (!vscode) throw new Error('vscode API required');

  const panel = vscode.window.createWebviewPanel('rivershade.preview', 'RiverShade Color Picker', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: false,
    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath || __dirname, 'media'))]
  });

  panel.webview.html = loadBundledHtml(context) || '<html><body>Missing media/palette-preview.html</body></html>';

  const cfg = vscode.workspace.getConfiguration();
  const ut = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
  const targetsToUpdate = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);

  const inspect = cfg.inspect('workbench.colorCustomizations') || {};
  const saveForTarget = (t) => {
    if (t === vscode.ConfigurationTarget.Global) return inspect.globalValue && Object.keys(inspect.globalValue).length ? inspect.globalValue : (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length ? inspect.globalLocalValue : (inspect.globalValue || inspect.globalLocalValue || undefined));
    if (t === vscode.ConfigurationTarget.Workspace) return inspect.workspaceValue && Object.keys(inspect.workspaceValue).length ? inspect.workspaceValue : (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length ? inspect.workspaceFolderValue : (inspect.workspaceValue || inspect.workspaceFolderValue || undefined));
    return undefined;
  };

  const originalValues = {};
  for (const t of targetsToUpdate) originalValues[t] = saveForTarget(t);

  let persisted = false;
  let previewTimer = null;

  const writePreviewToTarget = async (t, obj) => {
    try {
      const currentInspect = cfg.inspect('workbench.colorCustomizations') || {};
      const currentForTarget = (t === vscode.ConfigurationTarget.Global)
        ? (currentInspect.globalValue || currentInspect.globalLocalValue || undefined)
        : (currentInspect.workspaceValue || currentInspect.workspaceFolderValue || undefined);
      const existing = currentForTarget || {};
      const clone = Object.assign({}, existing, obj);
      const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
      await cfg.update('workbench.colorCustomizations', valueToSet, t);
    } catch (e) {
      // ignore preview write errors
    }
  };

  const schedulePreview = (obj) => {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      previewTimer = null;
      for (const t of targetsToUpdate) await writePreviewToTarget(t, obj);
    }, 120);
  };

  const buildAllowedMapping = (preset) => {
    let mapped = {};
    try {
      if (deps.colors && typeof deps.colors.buildColorsSet === 'function') {
        const scheme = (deps.getColorScheme && typeof deps.getColorScheme === 'function') ? deps.getColorScheme(cfg) : (cfg.get('rivershade.colorScheme') || 'default');
        mapped = deps.colors.buildColorsSet(scheme, { preset: preset || {}, toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true });
      } else {
        mapped = helpers.defaultMapPresetToColors(preset || {});
      }
    } catch (e) {
      mapped = helpers.defaultMapPresetToColors(preset || {});
    }

    const filtered = helpers.filterAllowedKeys(mapped);
    const out = Object.assign({}, filtered);
    const inactiveBg = out['titleBar.inactiveBackground'] || out['quickInputTitle.inactiveBackground'] || '#2f2f2f';
    ['activityBar.border','panel.border','sideBar.border','editorGroup.border','statusBar.border','titleBar.border'].forEach(k => {
      if (out[k]) {
        try { out[k] = helpers.blendOKLCHSafe(out[k], inactiveBg, 0.8); } catch (e) { /* ignore */ }
      }
    });
    return out;
  };

  // initial sync
  try {
    const cfgObj = cfg.get('workbench.colorCustomizations');
    const extract = (o) => {
      const get = (k) => {
        if (!o) return undefined;
        if (o[k]) return o[k];
        for (const kk of Object.keys(o)) {
          if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k];
        }
        return undefined;
      };
      return {
        themePrimary: get('titleBar.activeBackground') || get('rivershade.baseColor') || get('activityBar.background') || null,
        themeSecondary: get('statusBar.background') || get('statusBar.noFolderBackground') || null,
        themeTertiary: get('titleBar.border') || get('statusBar.border') || get('sideBar.border') || get('panel.border') || null
      };
    };
    const presetSync = extract(cfgObj);
    panel.webview.postMessage({ type: 'sync', data: presetSync });
  } catch (e) { /* ignore */ }

  const configListener = vscode.workspace.onDidChangeConfiguration((ev) => {
    try {
      if (!ev.affectsConfiguration || ev.affectsConfiguration('workbench.colorCustomizations')) {
        const current = cfg.get('workbench.colorCustomizations');
        const presetSync = (function extract(o){ const get = (k) => { if (!o) return undefined; if (o[k]) return o[k]; for (const kk of Object.keys(o)) { if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k]; } return undefined; }; return { themePrimary: get('titleBar.activeBackground')||get('rivershade.baseColor')||get('activityBar.background')||null, themeSecondary: get('statusBar.background')||get('statusBar.noFolderBackground')||null, themeTertiary: get('titleBar.border')||get('statusBar.border')||get('sideBar.border')||get('panel.border')||null }; })(current);
        try { panel.webview.postMessage({ type: 'sync', data: presetSync }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  });
  context.subscriptions.push(configListener);

  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      if (!msg) return;
      const t = msg.type || msg.command;
      if (t === 'preview') {
        const out = buildAllowedMapping(msg.preset || {});
        schedulePreview(out);
        return;
      }
      if (t === 'apply' || t === 'ok') {
        const out = buildAllowedMapping(msg.preset || {});
        for (const tg of targetsToUpdate) await writePreviewToTarget(tg, out);
        persisted = true;
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'cancel') {
        for (const tg of targetsToUpdate) {
          try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
        }
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'syncRequest') {
        const inspectNow = cfg.inspect('workbench.colorCustomizations') || {};
        const baseNow = (inspectNow.workspaceValue || inspectNow.globalValue) || {};
        panel.webview.postMessage({ type: 'sync', data: baseNow });
        return;
      }
    } catch (e) {
      try { console.error('colorPicker message handler error', e); } catch (ee) { /* ignore */ }
    }
  }, undefined, context.subscriptions);

  panel.onDidDispose(async () => {
    try {
      if (!persisted) {
        for (const tg of targetsToUpdate) {
          try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      try { console.error('colorPicker dispose restore error', e); } catch (ee) { /* ignore */ }
    }
  }, null, context.subscriptions);

  return panel;
}

module.exports = { openColorPicker };
/* lib/colorPicker.js
   Single clean implementation for the color picker webview.
   Responsibilities:
   - load bundled webview HTML
   - create webview panel and wire message handlers
   - schedule debounced preview writes that merge with existing workbench.colorCustomizations
   - snapshot & restore original values on cancel/dispose
*/

const fs = require('fs');
const path = require('path');
const helpers = require('./colorHelpers');

function loadBundledHtml(context) {
  const mediaPath = path.join(context.extensionPath || __dirname, 'media', 'palette-preview.html');
  if (!fs.existsSync(mediaPath)) return null;
  return fs.readFileSync(mediaPath, 'utf8');
}

function openColorPicker(context, deps = {}) {
  const vscode = deps.vscode;
  if (!vscode) throw new Error('vscode API required');

  const panel = vscode.window.createWebviewPanel('rivershade.preview', 'RiverShade Color Picker', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: false,
    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath || __dirname, 'media'))]
  });

  panel.webview.html = loadBundledHtml(context) || '<html><body>Missing media/palette-preview.html</body></html>';

  const cfg = vscode.workspace.getConfiguration();
  const ut = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
  const targetsToUpdate = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);

  const inspect = cfg.inspect('workbench.colorCustomizations') || {};
  const saveForTarget = (t) => {
    if (t === vscode.ConfigurationTarget.Global) return inspect.globalValue && Object.keys(inspect.globalValue).length ? inspect.globalValue : (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length ? inspect.globalLocalValue : (inspect.globalValue || inspect.globalLocalValue || undefined));
    if (t === vscode.ConfigurationTarget.Workspace) return inspect.workspaceValue && Object.keys(inspect.workspaceValue).length ? inspect.workspaceValue : (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length ? inspect.workspaceFolderValue : (inspect.workspaceValue || inspect.workspaceFolderValue || undefined));
    return undefined;
  };

  const originalValues = {};
  for (const t of targetsToUpdate) originalValues[t] = saveForTarget(t);

  let persisted = false;
  let previewTimer = null;

  const writePreviewToTarget = async (t, obj) => {
    try {
      const currentInspect = cfg.inspect('workbench.colorCustomizations') || {};
      const currentForTarget = (t === vscode.ConfigurationTarget.Global)
        ? (currentInspect.globalValue || currentInspect.globalLocalValue || undefined)
        : (currentInspect.workspaceValue || currentInspect.workspaceFolderValue || undefined);
      const existing = currentForTarget || {};
      const clone = Object.assign({}, existing, obj);
      const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
      await cfg.update('workbench.colorCustomizations', valueToSet, t);
    } catch (e) {
      // ignore preview write errors
    }
  };

  const schedulePreview = (obj) => {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      previewTimer = null;
      for (const t of targetsToUpdate) await writePreviewToTarget(t, obj);
    }, 120);
  };

  const buildAllowedMapping = (preset) => {
    let mapped = {};
    try {
      if (deps.colors && typeof deps.colors.buildColorsSet === 'function') {
        const scheme = (deps.getColorScheme && typeof deps.getColorScheme === 'function') ? deps.getColorScheme(cfg) : (cfg.get('rivershade.colorScheme') || 'default');
        mapped = deps.colors.buildColorsSet(scheme, { preset: preset || {}, toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true });
      } else {
        mapped = helpers.defaultMapPresetToColors(preset || {});
      }
    } catch (e) {
      mapped = helpers.defaultMapPresetToColors(preset || {});
    }

    const filtered = helpers.filterAllowedKeys(mapped);
    const out = Object.assign({}, filtered);
    const inactiveBg = out['titleBar.inactiveBackground'] || out['quickInputTitle.inactiveBackground'] || '#2f2f2f';
    ['activityBar.border','panel.border','sideBar.border','editorGroup.border','statusBar.border','titleBar.border'].forEach(k => {
      if (out[k]) {
        try { out[k] = helpers.blendOKLCHSafe(out[k], inactiveBg, 0.8); } catch (e) { /* ignore */ }
      }
    });
    return out;
  };

  // initial sync
  try {
    const cfgObj = cfg.get('workbench.colorCustomizations');
    const extract = (o) => {
      const get = (k) => {
        if (!o) return undefined;
        if (o[k]) return o[k];
        for (const kk of Object.keys(o)) {
          if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k];
        }
        return undefined;
      };
      return {
        themePrimary: get('titleBar.activeBackground') || get('rivershade.baseColor') || get('activityBar.background') || null,
        themeSecondary: get('statusBar.background') || get('statusBar.noFolderBackground') || null,
        themeTertiary: get('titleBar.border') || get('statusBar.border') || get('sideBar.border') || get('panel.border') || null
      };
    };
    const presetSync = extract(cfgObj);
    panel.webview.postMessage({ type: 'sync', data: presetSync });
  } catch (e) { /* ignore */ }

  const configListener = vscode.workspace.onDidChangeConfiguration((ev) => {
    try {
      if (!ev.affectsConfiguration || ev.affectsConfiguration('workbench.colorCustomizations')) {
        const current = cfg.get('workbench.colorCustomizations');
        const presetSync = (function extract(o){ const get = (k) => { if (!o) return undefined; if (o[k]) return o[k]; for (const kk of Object.keys(o)) { if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k]; } return undefined; }; return { themePrimary: get('titleBar.activeBackground')||get('rivershade.baseColor')||get('activityBar.background')||null, themeSecondary: get('statusBar.background')||get('statusBar.noFolderBackground')||null, themeTertiary: get('titleBar.border')||get('statusBar.border')||get('sideBar.border')||get('panel.border')||null }; })(current);
        try { panel.webview.postMessage({ type: 'sync', data: presetSync }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  });
  context.subscriptions.push(configListener);

  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      if (!msg) return;
      const t = msg.type || msg.command;
      if (t === 'preview') {
        const out = buildAllowedMapping(msg.preset || {});
        schedulePreview(out);
        return;
      }
      if (t === 'apply' || t === 'ok') {
        const out = buildAllowedMapping(msg.preset || {});
        for (const tg of targetsToUpdate) await writePreviewToTarget(tg, out);
        persisted = true;
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'cancel') {
        for (const tg of targetsToUpdate) {
          try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
        }
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'syncRequest') {
        const inspectNow = cfg.inspect('workbench.colorCustomizations') || {};
        const baseNow = (inspectNow.workspaceValue || inspectNow.globalValue) || {};
        panel.webview.postMessage({ type: 'sync', data: baseNow });
        return;
      }
    } catch (e) {
      try { console.error('colorPicker message handler error', e); } catch (ee) { /* ignore */ }
    }
  }, undefined, context.subscriptions);

  panel.onDidDispose(async () => {
    try {
      if (!persisted) {
        for (const tg of targetsToUpdate) {
          try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      try { console.error('colorPicker dispose restore error', e); } catch (ee) { /* ignore */ }
    }
  }, null, context.subscriptions);

  return panel;
}

module.exports = { openColorPicker };
/* lib/colorPicker.js
   Single, non-duplicated implementation for the color picker webview.
*/
const fs = require('fs');
const path = require('path');
const helpers = require('./colorHelpers');

function loadBundledHtml(context) {
  const mediaPath = path.join(context.extensionPath || __dirname, 'media', 'preset-preview.html');
  if (!fs.existsSync(mediaPath)) return null;
  return fs.readFileSync(mediaPath, 'utf8');
}

function openColorPicker(context, deps = {}) {
  const vscode = deps.vscode;
  if (!vscode) throw new Error('vscode API required');

  const panel = vscode.window.createWebviewPanel('rivershade.preview', 'RiverShade Color Picker', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: false,
    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath || __dirname, 'media'))]
  });

  panel.webview.html = loadBundledHtml(context) || '<html><body>Missing media/preset-preview.html</body></html>';

  const cfg = vscode.workspace.getConfiguration();
  const ut = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
  const targetsToUpdate = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);

  const inspect = cfg.inspect('workbench.colorCustomizations') || {};
  const saveForTarget = (t) => {
    if (t === vscode.ConfigurationTarget.Global) return inspect.globalValue && Object.keys(inspect.globalValue).length ? inspect.globalValue : (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length ? inspect.globalLocalValue : (inspect.globalValue || inspect.globalLocalValue || undefined));
    if (t === vscode.ConfigurationTarget.Workspace) return inspect.workspaceValue && Object.keys(inspect.workspaceValue).length ? inspect.workspaceValue : (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length ? inspect.workspaceFolderValue : (inspect.workspaceValue || inspect.workspaceFolderValue || undefined));
    return undefined;
  };

  const originalValues = {};
  for (const t of targetsToUpdate) originalValues[t] = saveForTarget(t);

  let persisted = false;
  let previewTimer = null;

  const writePreviewToTarget = async (t, obj) => {
    try {
      const currentInspect = cfg.inspect('workbench.colorCustomizations') || {};
      const currentForTarget = (t === vscode.ConfigurationTarget.Global)
        ? (currentInspect.globalValue || currentInspect.globalLocalValue || undefined)
        : (currentInspect.workspaceValue || currentInspect.workspaceFolderValue || undefined);
      const existing = currentForTarget || {};
      const clone = Object.assign({}, existing, obj);
      const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
      await cfg.update('workbench.colorCustomizations', valueToSet, t);
    } catch (e) {
      // ignore preview write errors
    }
  };

  const schedulePreview = (obj) => {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      previewTimer = null;
      for (const t of targetsToUpdate) await writePreviewToTarget(t, obj);
    }, 120);
  };

  const buildAllowedMapping = (preset) => {
    let mapped = {};
    try {
      if (deps.colors && typeof deps.colors.buildColorsSet === 'function') {
        const scheme = (deps.getColorScheme && typeof deps.getColorScheme === 'function') ? deps.getColorScheme(cfg) : (cfg.get('rivershade.colorScheme') || 'default');
        mapped = deps.colors.buildColorsSet(scheme, { preset: preset || {}, toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true });
      } else {
        mapped = helpers.defaultMapPresetToColors(preset || {});
      }
    } catch (e) {
      mapped = helpers.defaultMapPresetToColors(preset || {});
    }

    const filtered = helpers.filterAllowedKeys(mapped);
    const out = Object.assign({}, filtered);
    const inactiveBg = out['titleBar.inactiveBackground'] || out['quickInputTitle.inactiveBackground'] || '#2f2f2f';
    ['activityBar.border','panel.border','sideBar.border','editorGroup.border','statusBar.border','titleBar.border'].forEach(k => {
      if (out[k]) {
        try { out[k] = helpers.blendOKLCHSafe(out[k], inactiveBg, 0.8); } catch (e) { /* ignore */ }
      }
    });
    return out;
  };

  // initial sync
  try {
    const cfgObj = cfg.get('workbench.colorCustomizations');
    const extract = (o) => {
      const get = (k) => {
        if (!o) return undefined;
        if (o[k]) return o[k];
        for (const kk of Object.keys(o)) {
          if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k];
        }
        return undefined;
      };
      return {
        themePrimary: get('titleBar.activeBackground') || get('rivershade.baseColor') || get('activityBar.background') || null,
        themeSecondary: get('statusBar.background') || get('statusBar.noFolderBackground') || null,
        themeTertiary: get('titleBar.border') || get('statusBar.border') || get('sideBar.border') || get('panel.border') || null
      };
    };
    const presetSync = extract(cfgObj);
    panel.webview.postMessage({ type: 'sync', data: presetSync });
  } catch (e) { /* ignore */ }

  const configListener = vscode.workspace.onDidChangeConfiguration((ev) => {
    try {
      if (!ev.affectsConfiguration || ev.affectsConfiguration('workbench.colorCustomizations')) {
        const current = cfg.get('workbench.colorCustomizations');
        const presetSync = (function extract(o){ const get = (k) => { if (!o) return undefined; if (o[k]) return o[k]; for (const kk of Object.keys(o)) { if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k]; } return undefined; }; return { themePrimary: get('titleBar.activeBackground')||get('rivershade.baseColor')||get('activityBar.background')||null, themeSecondary: get('statusBar.background')||get('statusBar.noFolderBackground')||null, themeTertiary: get('titleBar.border')||get('statusBar.border')||get('sideBar.border')||get('panel.border')||null }; })(current);
        try { panel.webview.postMessage({ type: 'sync', data: presetSync }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  });
  context.subscriptions.push(configListener);

  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      if (!msg) return;
      const t = msg.type || msg.command;
      if (t === 'preview') {
        const out = buildAllowedMapping(msg.preset || {});
        schedulePreview(out);
        return;
      }
      if (t === 'apply' || t === 'ok') {
        const out = buildAllowedMapping(msg.preset || {});
        for (const tg of targetsToUpdate) await writePreviewToTarget(tg, out);
        persisted = true;
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'cancel') {
        for (const tg of targetsToUpdate) {
          try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
        }
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'syncRequest') {
        const inspectNow = cfg.inspect('workbench.colorCustomizations') || {};
        const baseNow = (inspectNow.workspaceValue || inspectNow.globalValue) || {};
        panel.webview.postMessage({ type: 'sync', data: baseNow });
        return;
      }
    } catch (e) {
      try { console.error('colorPicker message handler error', e); } catch (ee) { /* ignore */ }
    }
  }, undefined, context.subscriptions);

  panel.onDidDispose(async () => {
    try {
      if (!persisted) {
        for (const tg of targetsToUpdate) {
          try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      try { console.error('colorPicker dispose restore error', e); } catch (ee) { /* ignore */ }
    }
  }, null, context.subscriptions);

  return panel;
}

module.exports = { openColorPicker };
/* colorPicker.js
   Encapsulates the webview picker UI and message handling.
*/
const fs = require('fs');
const path = require('path');
const helpers = require('./colorHelpers');

function loadBundledHtml(panel, context) {
  const mediaPath = path.join(context.extensionPath || __dirname, 'media', 'preset-preview.html');
  if (!fs.existsSync(mediaPath)) return null;
  let html = fs.readFileSync(mediaPath, 'utf8');
  // rewrite local resource links to webview URIs if needed (none in this template)
  return html;
}

function openColorPicker(context, deps) {
  // deps: { vscode, colors, outputHelpers, getConfig, getColorScheme }
  const { vscode, colors, outputHelpers, getConfig, getColorScheme } = deps || {};
  try {
    const panel = vscode.window.createWebviewPanel('rivershade.preview', 'RiverShade Color Picker', vscode.ViewColumn.One, { enableScripts: true });
    const bundled = loadBundledHtml(panel, context);
    if (bundled) panel.webview.html = bundled;
    else panel.webview.html = '<html><body>Missing media/preset-preview.html</body></html>';

    const cfg = vscode.workspace.getConfiguration();

    // Helper to extract preset-like object
    const extractPresetFromConfig = (cfgObj) => {
      const get = (k) => {
        if (!cfgObj) return undefined;
        if (cfgObj[k]) return cfgObj[k];
        for (const kk of Object.keys(cfgObj)) {
          if (kk.startsWith('[') && cfgObj[kk] && cfgObj[kk][k]) return cfgObj[kk][k];
        }
        return undefined;
      };
      const primary = get('titleBar.activeBackground') || get('rivershade.baseColor') || get('activityBar.background') || null;
      const secondary = get('statusBar.background') || get('statusBar.noFolderBackground') || null;
      const tertiary = get('titleBar.border') || get('statusBar.border') || get('sideBar.border') || get('panel.border') || null;
      return { themePrimary: primary, themeSecondary: secondary, themeTertiary: tertiary };
    };

    try {
      const cfgObj = cfg.get('workbench.colorCustomizations');
      const presetSync = extractPresetFromConfig(cfgObj);
      panel.webview.postMessage({ command: 'sync', preset: presetSync });
    } catch (e) { /* ignore */ }

    const configListener = vscode.workspace.onDidChangeConfiguration((ev) => {
      try {
        if (!ev.affectsConfiguration || ev.affectsConfiguration('workbench.colorCustomizations')) {
          const current = cfg.get('workbench.colorCustomizations');
          const synced = extractPresetFromConfig(current);
          try { panel.webview.postMessage({ command: 'sync', preset: synced }); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    });
    context.subscriptions.push(configListener);

    // Snapshot current settings for restore on cancel
    const inspect = cfg.inspect('workbench.colorCustomizations') || {};
    const saveForTarget = (t) => {
      if (t === vscode.ConfigurationTarget.Global) return inspect.globalValue && Object.keys(inspect.globalValue).length ? inspect.globalValue : (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length ? inspect.globalLocalValue : (inspect.globalValue || inspect.globalLocalValue || undefined));
      if (t === vscode.ConfigurationTarget.Workspace) return inspect.workspaceValue && Object.keys(inspect.workspaceValue).length ? inspect.workspaceValue : (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length ? inspect.workspaceFolderValue : (inspect.workspaceValue || inspect.workspaceFolderValue || undefined));
      return undefined;
    };

    const { settings } = getConfig();
    const ut = settings.updateTarget || 'global';
    const targetsToUpdate = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);

    const originalValues = {};
    for (const t of targetsToUpdate) originalValues[t] = saveForTarget(t);

    let persisted = false;

    /* colorPicker.js
       Responsible for creating the webview panel for the color picker and handling
       messages from the UI. Keeps side effects (writes to workbench.colorCustomizations)
       constrained and merges with latest settings to avoid clobbering unrelated keys.
    */
    const fs2 = require('fs');
    const path2 = require('path');
    const helpers2 = require('./colorHelpers');

    function loadBundledHtml(panel, context) {
      const mediaPath = path2.join(context.extensionPath || __dirname, 'media', 'preset-preview.html');
      if (!fs2.existsSync(mediaPath)) return null;
      let html = fs2.readFileSync(mediaPath, 'utf8');
      // No external assets in the template; if there were, we'd rewrite URIs with panel.webview.asWebviewUri
      return html;
    }

    function openColorPicker(context, deps = {}) {
      const vscode = deps.vscode;
      if (!vscode) throw new Error('vscode API required');

      const panel = vscode.window.createWebviewPanel('rivershade.preview', 'RiverShade Color Picker', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [vscode.Uri.file(path2.join(context.extensionPath || __dirname, 'media'))]
      });

      const html = loadBundledHtml(panel, context) || '<html><body>Missing media/preset-preview.html</body></html>';
      /* colorPicker.js
         Responsible for creating the webview panel for the color picker and handling
         messages from the UI. Keeps side effects (writes to workbench.colorCustomizations)
         constrained and merges with latest settings to avoid clobbering unrelated keys.
      */
      const fs = require('fs');
      const path = require('path');
      const helpers = require('./colorHelpers');

      function loadBundledHtml(panel, context) {
        const mediaPath = path.join(context.extensionPath || __dirname, 'media', 'preset-preview.html');
        if (!fs.existsSync(mediaPath)) return null;
        let html = fs.readFileSync(mediaPath, 'utf8');
        return html;
      }

      function openColorPicker(context, deps = {}) {
        const vscode = deps.vscode;
        if (!vscode) throw new Error('vscode API required');

        const panel = vscode.window.createWebviewPanel('rivershade.preview', 'RiverShade Color Picker', vscode.ViewColumn.One, {
          enableScripts: true,
          retainContextWhenHidden: false,
          localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath || __dirname, 'media'))]
        });

        const html = loadBundledHtml(panel, context) || '<html><body>Missing media/preset-preview.html</body></html>';
        panel.webview.html = html;

        const cfg = vscode.workspace.getConfiguration();

        const ut = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
        const targetsToUpdate = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);

        const inspect = cfg.inspect('workbench.colorCustomizations') || {};
        const saveForTarget = (t) => {
          if (t === vscode.ConfigurationTarget.Global) return inspect.globalValue && Object.keys(inspect.globalValue).length ? inspect.globalValue : (inspect.globalLocalValue && Object.keys(inspect.globalLocalValue).length ? inspect.globalLocalValue : (inspect.globalValue || inspect.globalLocalValue || undefined));
          if (t === vscode.ConfigurationTarget.Workspace) return inspect.workspaceValue && Object.keys(inspect.workspaceValue).length ? inspect.workspaceValue : (inspect.workspaceFolderValue && Object.keys(inspect.workspaceFolderValue).length ? inspect.workspaceFolderValue : (inspect.workspaceValue || inspect.workspaceFolderValue || undefined));
          return undefined;
        };
        const originalValues = {};
        for (const t of targetsToUpdate) originalValues[t] = saveForTarget(t);

        let persisted = false;
        let previewTimer = null;

        const writePreviewToTarget = async (t, obj) => {
          try {
            const currentInspect = cfg.inspect('workbench.colorCustomizations') || {};
            const currentForTarget = (t === vscode.ConfigurationTarget.Global)
              ? (currentInspect.globalValue || currentInspect.globalLocalValue || undefined)
              : (currentInspect.workspaceValue || currentInspect.workspaceFolderValue || undefined);
            const existing = currentForTarget || {};
            const clone = Object.assign({}, existing, obj);
            const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
            await cfg.update('workbench.colorCustomizations', valueToSet, t);
          } catch (e) {
            // ignore preview write errors
          }
        };

        const schedulePreview = (obj) => {
          if (previewTimer) clearTimeout(previewTimer);
          previewTimer = setTimeout(async () => {
            previewTimer = null;
            for (const t of targetsToUpdate) await writePreviewToTarget(t, obj);
          }, 120);
        };

        const buildAllowedMapping = (preset) => {
          let mapped = {};
          try {
            if (deps.colors && typeof deps.colors.buildColorsSet === 'function') {
              const scheme = (deps.getColorScheme && typeof deps.getColorScheme === 'function') ? deps.getColorScheme(cfg) : (cfg.get('rivershade.colorScheme') || 'default');
              mapped = deps.colors.buildColorsSet(scheme, { preset: preset || {}, toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true });
            } else {
              mapped = helpers.defaultMapPresetToColors(preset || {});
            }
          } catch (e) {
            mapped = helpers.defaultMapPresetToColors(preset || {});
          }

          const filtered = helpers.filterAllowedKeys(mapped);
          const out = Object.assign({}, filtered);
          const inactiveBg = out['titleBar.inactiveBackground'] || out['quickInputTitle.inactiveBackground'] || '#2f2f2f';
          ['activityBar.border','panel.border','sideBar.border','editorGroup.border','statusBar.border','titleBar.border'].forEach(k => {
            if (out[k]) {
              try { out[k] = helpers.blendOKLCHSafe(out[k], inactiveBg, 0.8); } catch (e) { /* ignore */ }
            }
          });
          return out;
        };

        try {
          const cfgObj = cfg.get('workbench.colorCustomizations');
          const extract = (o) => {
            const get = (k) => {
              if (!o) return undefined;
              if (o[k]) return o[k];
              for (const kk of Object.keys(o)) {
                if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k];
              }
              return undefined;
            };
            return {
              themePrimary: get('titleBar.activeBackground') || get('rivershade.baseColor') || get('activityBar.background') || null,
              themeSecondary: get('statusBar.background') || get('statusBar.noFolderBackground') || null,
              themeTertiary: get('titleBar.border') || get('statusBar.border') || get('sideBar.border') || get('panel.border') || null
            };
          };
          const presetSync = extract(cfgObj);
          panel.webview.postMessage({ type: 'sync', data: presetSync });
        } catch (e) { /* ignore */ }

        const configListener = vscode.workspace.onDidChangeConfiguration((ev) => {
          try {
            if (!ev.affectsConfiguration || ev.affectsConfiguration('workbench.colorCustomizations')) {
              const current = cfg.get('workbench.colorCustomizations');
              const presetSync = (function extract(o){ const get = (k) => { if (!o) return undefined; if (o[k]) return o[k]; for (const kk of Object.keys(o)) { if (kk.startsWith('[') && o[kk] && o[kk][k]) return o[kk][k]; } return undefined; }; return { themePrimary: get('titleBar.activeBackground')||get('rivershade.baseColor')||get('activityBar.background')||null, themeSecondary: get('statusBar.background')||get('statusBar.noFolderBackground')||null, themeTertiary: get('titleBar.border')||get('statusBar.border')||get('sideBar.border')||get('panel.border')||null }; })(current);
              try { panel.webview.postMessage({ type: 'sync', data: presetSync }); } catch (e) { /* ignore */ }
            }
          } catch (e) { /* ignore */ }
        });
        context.subscriptions.push(configListener);

        panel.webview.onDidReceiveMessage(async (msg) => {
          try {
            if (!msg) return;
            const t = msg.type || msg.command;
            if (t === 'preview') {
              const out = buildAllowedMapping(msg.preset || {});
              schedulePreview(out);
              return;
            }
            if (t === 'apply' || t === 'ok') {
              const out = buildAllowedMapping(msg.preset || {});
              for (const tg of targetsToUpdate) await writePreviewToTarget(tg, out);
              persisted = true;
              try { panel.dispose(); } catch (e) { /* ignore */ }
              return;
            }
            if (t === 'cancel') {
              for (const tg of targetsToUpdate) {
                try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
              }
              try { panel.dispose(); } catch (e) { /* ignore */ }
              return;
            }
            if (t === 'syncRequest') {
              const inspectNow = cfg.inspect('workbench.colorCustomizations') || {};
              const baseNow = (inspectNow.workspaceValue || inspectNow.globalValue) || {};
              panel.webview.postMessage({ type: 'sync', data: baseNow });
              return;
            }
          } catch (e) {
            try { console.error('colorPicker message handler error', e); } catch (ee) { /* ignore */ }
          }
        }, undefined, context.subscriptions);

        panel.onDidDispose(async () => {
          try {
            if (!persisted) {
              for (const tg of targetsToUpdate) {
                try { await cfg.update('workbench.colorCustomizations', originalValues[tg], tg); } catch (e) { /* ignore */ }
              }
            }
          } catch (e) {
            try { console.error('colorPicker dispose restore error', e); } catch (ee) { /* ignore */ }
          }
        }, null, context.subscriptions);

        return panel;
      }

      module.exports = { openColorPicker };
