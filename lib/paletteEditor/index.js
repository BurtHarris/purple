/* lib/paletteEditor/index.js
   Entry point for the palette editor (renamed from colorPicker).
*/

const htmlLoader = require('./htmlLoader');
const createMessageHandler = require('./messageHandler');
const createConfigWriter = require('./configWriter');
const createPreviewScheduler = require('./previewScheduler');
const mapPaletteToColors = require('./paletteMapper');

module.exports.openPaletteEditor = function openPaletteEditor(context, deps = {}) {
  // keep same wiring behavior as colorPicker.index.js but export a palette-named API
  const vscode = deps.vscode;
  if (!vscode) throw new Error('vscode API required');

  const panel = vscode.window.createWebviewPanel('rivershade.palettePreview', 'RiverShade Palette Editor', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: false,
    localResourceRoots: [vscode.Uri.file(require('path').join(context.extensionPath || __dirname, 'media'))]
  });

  const asWebviewUri = (absPath) => panel.webview.asWebviewUri(require('vscode').Uri.file(absPath)).toString();
  const mediaDir = require('path').join(context.extensionPath || __dirname, '..', 'media');
  const html = htmlLoader.loadBundledHtml(context, { asWebviewUri, mediaDir, webview: panel.webview });
  if (html) panel.webview.html = html;

  const cfg = vscode.workspace.getConfiguration();
  const cfgWriter = createConfigWriter({ cfg, vscode });
  const ut = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
  const targetsSnapshot = ut === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);
  const originals = cfgWriter.snapshotTargets(targetsSnapshot);

  const scheduler = createPreviewScheduler({ writeFn: async (obj) => {
    const ut2 = cfg.get('rivershade.updateTarget') || cfg.get('focusColorToggle.updateTarget') || 'global';
    const targets = ut2 === 'both' ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : (ut2 === 'workspace' ? [vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global]);
    for (const t of targets) await cfgWriter.writeToTarget(t, obj);
  } });

  const mapper = mapPaletteToColors.bind(null, { helpers: require('../colorHelpers'), colors: deps.colors, getColorScheme: deps.getColorScheme });

  const targetsToUpdate = (cfg.get('rivershade.updateTarget') === 'both') ? [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace] : [vscode.ConfigurationTarget.Global];

  const handler = createMessageHandler({ cfgWriter, mapper, scheduler, panel, context, targetsToUpdate, originals, deps: { vscode } });

  const configListener = vscode.workspace.onDidChangeConfiguration((ev) => {
    try {
      if (!ev.affectsConfiguration || ev.affectsConfiguration('workbench.colorCustomizations')) {
        const current = cfg.get('workbench.colorCustomizations');
        try { panel.webview.postMessage({ type: 'sync', data: current || {} }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  });
  context.subscriptions.push(configListener);

  panel.webview.onDidReceiveMessage((msg) => handler.onMessage(msg), undefined, context.subscriptions);

  panel.onDidDispose(() => {
    try { if (handler && typeof handler.onDispose === 'function') handler.onDispose(); } catch (e) { /* ignore */ }
  });
  context.subscriptions.push(panel);
  return panel;
};
