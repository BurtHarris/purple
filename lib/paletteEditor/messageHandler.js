/* lib/paletteEditor/messageHandler.js */
module.exports = function createMessageHandler({ cfgWriter, mapper, scheduler, panel, context, targetsToUpdate = [], originals = {}, deps = {} } = {}) {
  let persisted = false;
  const { vscode } = deps || {};

  const restoreOriginals = async () => {
    try {
      if (!persisted && originals && cfgWriter && typeof cfgWriter.restoreTargets === 'function') {
        await cfgWriter.restoreTargets(originals);
      }
    } catch (e) { /* ignore */ }
  };

  const onMessage = async (msg) => {
    if (!msg) return;
    const t = msg.type || msg.command;
    try {
      if (t === 'preview') {
        const out = mapper(msg.palette || {});
        scheduler.schedule(out);
        return;
      }
      if (t === 'apply' || t === 'ok') {
        const out = mapper(msg.palette || {});
        for (const tg of targetsToUpdate) await cfgWriter.writeToTarget(tg, out);
        persisted = true;
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'cancel') {
        await restoreOriginals();
        try { panel.dispose(); } catch (e) { /* ignore */ }
        return;
      }
      if (t === 'syncRequest') {
        try {
          const inspectNow = (vscode && vscode.workspace && vscode.workspace.getConfiguration) ? vscode.workspace.getConfiguration().get('workbench.colorCustomizations') : undefined;
          panel.webview.postMessage({ type: 'sync', data: inspectNow || {} });
        } catch (e) { /* ignore */ }
        return;
      }
    } catch (e) {
      try { console.error('messageHandler error', e); } catch (ee) { /* ignore */ }
    }
  };

  const onDispose = async () => { await restoreOriginals(); };

  return { onMessage, onDispose };
};
