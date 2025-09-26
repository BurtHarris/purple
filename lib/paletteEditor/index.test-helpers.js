/* lib/paletteEditor/index.test-helpers.js */
function makeFakePanel() {
  const listeners = [];
  return {
    webview: { postMessage: (m) => { /* no-op for tests */ }, onDidReceiveMessage: () => { /* ignored */ } },
    onDidDispose: (cb) => { listeners.push(cb); },
    dispose: () => { listeners.forEach(fn => fn()); }
  };
}

function makeFakeCfg() {
  const data = {};
  return {
    inspect: (k) => { const rec = data[k] || {}; return { globalValue: rec.globalValue, workspaceValue: rec.workspaceValue, workspaceFolderValue: rec.workspaceFolderValue }; },
    get: (k) => data[k],
    update: async (k, v, t) => { if (!data[k]) data[k] = {}; if (t === 1 || String(t).toLowerCase().includes('global')) data[k].globalValue = v; else if (t === 2 || String(t).toLowerCase().includes('workspace')) data[k].workspaceValue = v; else data[k].globalValue = v; }
  };
}

module.exports = { makeFakePanel, makeFakeCfg };
