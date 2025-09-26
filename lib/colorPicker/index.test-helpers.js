/* lib/colorPicker/index.test-helpers.js
   Small helpers for tests: create fake panel, fake cfg, fake vscode objects.
   These are minimal and intended to speed unit testing later.
*/

function makeFakePanel() {
  const listeners = [];
  return {
    webview: {
      postMessage: (m) => { /* no-op for tests */ },
      onDidReceiveMessage: () => { /* ignored */ }
    },
    onDidDispose: (cb) => { listeners.push(cb); },
    dispose: () => { listeners.forEach(fn => fn()); }
  };
}

function makeFakeCfg() {
  // store values per key per target to better emulate vscode's config inspect/update
  const data = {};
  return {
    inspect: (k) => {
      const rec = data[k] || {};
      return { globalValue: rec.globalValue, workspaceValue: rec.workspaceValue, workspaceFolderValue: rec.workspaceFolderValue };
    },
    get: (k) => data[k],
    update: async (k, v, t) => {
      if (!data[k]) data[k] = {};
      // t may be numeric; treat 1 as Global, 2 as Workspace in tests
      if (t === 1 || String(t).toLowerCase().includes('global')) data[k].globalValue = v;
      else if (t === 2 || String(t).toLowerCase().includes('workspace')) data[k].workspaceValue = v;
      else data[k].globalValue = v;
    }
  };
}

module.exports = { makeFakePanel, makeFakeCfg };
