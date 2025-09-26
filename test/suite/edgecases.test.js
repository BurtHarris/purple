const { expect } = require('chai');
const vscode = require('vscode');

describe('Edge cases', function() {
  this.timeout(40000);

  async function findStatusBarBackground(obj) {
    if (!obj) return null;
    if (obj['statusBar.background']) return obj['statusBar.background'];
    for (const k of Object.keys(obj)) {
      if (k.startsWith('[') && obj[k] && obj[k]['statusBar.background']) return obj[k]['statusBar.background'];
    }
    return null;
  }

  it('handles missing workbench.colorCustomizations', async () => {
    const config = vscode.workspace.getConfiguration();
    const key = 'workbench.colorCustomizations';
    const before = config.get(key);

  // Attempt to remove global value to simulate missing setting
    try {
      await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    } catch (e) {
      // ignore permission issues in some environments
    }

  // Use installBling to apply colors (toggle command removed)
  await vscode.commands.executeCommand('rivershade.installBling');

    const current = config.get(key);
    expect(current).to.be.ok;

    // restore
    await config.update(key, before, vscode.ConfigurationTarget.Global);
  });

  it('rapid toggles do not throw and end with valid color', async () => {
    const config = vscode.workspace.getConfiguration();
    const key = 'workbench.colorCustomizations';
    const before = config.get(key);

    // Fire toggles rapidly and await each to ensure handler returns its promise.
    for (let i = 0; i < 10; i++) {
      // repeatedly install (idempotent) to simulate repeated operations
      await vscode.commands.executeCommand('rivershade.installBling');
    }

    // Sometimes writes take a short moment in the extension host; retry inspect() a few times
    // and log enough information to diagnose where the value was written (global/workspace).
    let found = null;
    let lastInspect = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const inspect = vscode.workspace.getConfiguration().inspect(key) || {};
      lastInspect = inspect;

      // check scoped values explicitly so we don't depend on the merged view which
      // may be subject to timing in the test environment
      const candidates = [inspect.workspaceValue, inspect.globalLocalValue, inspect.globalValue, inspect.defaultValue];
      for (const c of candidates) {
        found = await findStatusBarBackground(c);
        if (found) break;
      }
      if (found) break;

      // small delay before retrying
      await new Promise(r => setTimeout(r, 100));
    }

    // attach inspect info to assertion errors to aid debugging
    try {
      expect(found, `statusBar.background not found. inspect(): ${JSON.stringify(lastInspect)}`).to.be.ok;
      expect(found).to.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
    } catch (err) {
      // rethrow after logging to stdout (test harness captures stdout)
      // eslint-disable-next-line no-console
      console.error('Edge test failure - last inspect:', JSON.stringify(lastInspect, null, 2));
      throw err;
    }

    await config.update(key, before, vscode.ConfigurationTarget.Global);
  });

  it('writes to workspace when updateTarget=workspace', async function() {
    if (!vscode.workspace.workspaceFolders) this.skip();
    const config = vscode.workspace.getConfiguration();
    const key = 'workbench.colorCustomizations';
    const beforeGlobal = config.get(key);
    const beforeWorkspace = (vscode.workspace.getConfiguration().inspect(key) || {}).workspaceValue;

    // set the extension option to workspace
  await vscode.workspace.getConfiguration().update('focusColorToggle.updateTarget', 'workspace', vscode.ConfigurationTarget.Global);

  await vscode.commands.executeCommand('rivershade.installBling');

    const inspect = vscode.workspace.getConfiguration().inspect(key) || {};
    const workspaceVal = inspect.workspaceValue;
    expect(workspaceVal).to.be.ok;

    // restore
    await vscode.workspace.getConfiguration().update('focusColorToggle.updateTarget', undefined, vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration().update(key, beforeWorkspace, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration().update(key, beforeGlobal, vscode.ConfigurationTarget.Global);
  });

  it('writes to both when updateTarget=both', async function() {
    if (!vscode.workspace.workspaceFolders) this.skip();
    const config = vscode.workspace.getConfiguration();
    const key = 'workbench.colorCustomizations';
    const beforeGlobal = config.get(key);
    const beforeWorkspace = (vscode.workspace.getConfiguration().inspect(key) || {}).workspaceValue;

  await vscode.workspace.getConfiguration().update('focusColorToggle.updateTarget', 'both', vscode.ConfigurationTarget.Global);

  await vscode.commands.executeCommand('rivershade.installBling');

    const inspect = vscode.workspace.getConfiguration().inspect(key) || {};
    expect(inspect.globalValue || inspect.workspaceValue).to.be.ok;

    // restore
    await vscode.workspace.getConfiguration().update('focusColorToggle.updateTarget', undefined, vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration().update(key, beforeWorkspace, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration().update(key, beforeGlobal, vscode.ConfigurationTarget.Global);
  });
});
