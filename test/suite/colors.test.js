const { expect } = require('chai');
const vscode = require('vscode');

describe('Color application', function() {
  this.timeout(20000);

  it('applies expected status bar color when toggled', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    expect(ext).to.exist;
    await ext.activate();
    expect(ext.isActive).to.be.true;

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

    expect(found).to.be.ok;

    // Expect either the ACTIVE or INACTIVE background keys defined in extension; check that it's a hex color string
    expect(found).to.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
  });
});
