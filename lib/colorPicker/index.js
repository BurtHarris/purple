/* lib/colorPicker/index.js
   Entry point for the refactored color picker.
   Composes smaller modules (htmlLoader, messageHandler, configWriter, previewScheduler, presetMapper).
   This file keeps the single exported API openColorPicker(context, deps={}).
*/

const htmlLoader = require('./htmlLoader');
const createMessageHandler = require('./messageHandler');
const createConfigWriter = require('./configWriter');
const createPreviewScheduler = require('./previewScheduler');
const mapPaletteToColors = require('./paletteMapper');

module.exports.openColorPicker = function openColorPicker(context, deps = {}) {
  const vscode = deps.vscode;
  if (!vscode) throw new Error('vscode API required');

  // Create panel and wire components (minimal safe wiring for now)
  const panel = vscode.window.createWebviewPanel('rivershade.preview', 'RiverShade Color Picker', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: false,
    localResourceRoots: [vscode.Uri.file(require('path').join(context.extensionPath || __dirname, 'media'))]
  });

  // Load HTML if available, pass a small asWebviewUri helper to avoid requiring vscode in loader
  const asWebviewUri = (absPath) => panel.webview.asWebviewUri(require('vscode').Uri.file(absPath)).toString();
  const mediaDir = require('path').join(context.extensionPath || __dirname, '..', 'media');
  const html = htmlLoader.loadBundledHtml(context, { asWebviewUri, mediaDir, webview: panel.webview });
  if (html) panel.webview.html = html;

  // Create helpers
  const cfg = vscode.workspace.getConfiguration();
  const cfgWriter = createConfigWriter({ cfg, vscode });
  // snapshot originals for targets we'll update so cancel/restore can use them
  const ut = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
  const targetsSnapshot = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);
  const originals = cfgWriter.snapshotTargets(targetsSnapshot);
  const scheduler = createPreviewScheduler({ writeFn: async (obj) => {
    const ut = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
    const targets = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);
    for (const t of targets) await cfgWriter.writeToTarget(t, obj);
  } });

  const mapper = mapPaletteToColors.bind(null, { helpers: require('../colorHelpers'), colors: deps.colors, getColorScheme: deps.getColorScheme });

  const targetsToUpdate = (cfg.get('rivershade.updateTarget') === 'both') ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global];

  const handler = createMessageHandler({ cfgWriter, mapper, scheduler, panel, context, targetsToUpdate, originals, deps: { vscode } });

  // configuration change listener: propagate sync messages to webview
  const configListener = vscode.workspace.onDidChangeConfiguration((ev) => {
    try {
      if (!ev.affectsConfiguration || ev.affectsConfiguration('workbench.colorCustomizations')) {
        const current = cfg.get('workbench.colorCustomizations');
        try { panel.webview.postMessage({ type: 'sync', data: current || {} }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  });
  context.subscriptions.push(configListener);

  // Wire messages
  panel.webview.onDidReceiveMessage((msg) => handler.onMessage(msg), undefined, context.subscriptions);

  // Push any listeners into context.subscriptions in handler itself where appropriate
  // register a panel dispose hook so the handler can restore originals if needed
  panel.onDidDispose(() => {
    try { if (handler && typeof handler.onDispose === 'function') handler.onDispose(); } catch (e) { /* ignore */ }
  });
  context.subscriptions.push(panel);
  return panel;
};