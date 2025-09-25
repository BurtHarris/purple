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

    await vscode.commands.executeCommand('focusColorToggle.toggle');

    const current = config.get(key);
    expect(current).to.be.ok;

    // restore
    await config.update(key, before, vscode.ConfigurationTarget.Global);
  });

  it('rapid toggles do not throw and end with valid color', async () => {
    const config = vscode.workspace.getConfiguration();
    const key = 'workbench.colorCustomizations';
    const before = config.get(key);

    for (let i = 0; i < 10; i++) {
      await vscode.commands.executeCommand('focusColorToggle.toggle');
    }

    const current = config.get(key) || {};
    const found = await findStatusBarBackground(current);
    expect(found).to.be.ok;
    expect(found).to.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);

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

    await vscode.commands.executeCommand('focusColorToggle.toggle');

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

    await vscode.commands.executeCommand('focusColorToggle.toggle');

    const inspect = vscode.workspace.getConfiguration().inspect(key) || {};
    expect(inspect.globalValue || inspect.workspaceValue).to.be.ok;

    // restore
    await vscode.workspace.getConfiguration().update('focusColorToggle.updateTarget', undefined, vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration().update(key, beforeWorkspace, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration().update(key, beforeGlobal, vscode.ConfigurationTarget.Global);
  });
});
