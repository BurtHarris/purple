const assert = require('assert');
const vscode = require('vscode');

describe('Color application', function() {
  this.timeout(20000);

  it('applies expected status bar color when toggled', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    assert.ok(ext, 'Extension not found');
    await ext.activate();
    assert.ok(ext.isActive, 'Extension did not activate');

    // Ensure initial toggle runs
    await vscode.commands.executeCommand('focusColorToggle.toggle');

    // The extension writes to workbench.colorCustomizations either globally or to workspace
    const inspect = vscode.workspace.getConfiguration().inspect('workbench.colorCustomizations');

    // Helper to find the statusBar background in a given object, including theme-scoped block
    function findStatusBarBackground(obj) {
      if (!obj) return null;
      if (obj['statusBar.background']) return obj['statusBar.background'];
      // check theme-scoped blocks (keys like "[Theme Name]")
      for (const k of Object.keys(obj)) {
        if (k.startsWith('[') && typeof obj[k] === 'object') {
          if (obj[k]['statusBar.background']) return obj[k]['statusBar.background'];
        }
      }
      return null;
    }

    // Wait up to a few seconds for colorCustomizations to be updated
    const start = Date.now();
    let found = null;
    while (Date.now() - start < 8000) {
      const cfg = vscode.workspace.getConfiguration();
      const current = cfg.get('workbench.colorCustomizations');
      found = findStatusBarBackground(current) || (inspect && (findStatusBarBackground(inspect.globalValue) || findStatusBarBackground(inspect.workspaceValue)));
      if (found) break;
      await new Promise(r => setTimeout(r, 200));
    }

    assert.ok(found, `Expected statusBar.background to be set but it was not (checked up to 8s)`);

    // Expect either the ACTIVE or INACTIVE background keys defined in extension; check that it's a hex color string
    assert.match(found, /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'statusBar.background is not a hex color');
  });
});
