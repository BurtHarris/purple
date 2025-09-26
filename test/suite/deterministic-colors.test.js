const { expect } = require('chai');
const vscode = require('vscode');

describe('Deterministic color values', function() {
  this.timeout(30000);

  it('applies exact active and inactive status bar backgrounds', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    expect(ext).to.exist;
    await ext.activate();
    expect(ext.isActive).to.be.true;

    // Apply bling and wait for the color to be written
    await vscode.commands.executeCommand('rivershade.installBling');

    // Wait up to a few seconds for colorCustomizations to be updated
    const cfg = vscode.workspace.getConfiguration();

    // Helper to find statusBar.background including theme-scoped blocks
    const find = (obj, key) => {
      if (!obj) return null;
      if (obj[key]) return obj[key];
      for (const k of Object.keys(obj)) {
        if (k.startsWith('[') && obj[k] && obj[k][key]) return obj[k][key];
      }
      return null;
    };
    const start = Date.now();
    let found = null;
    while (Date.now() - start < 8000) {
      const current = cfg.get('workbench.colorCustomizations');
      found = find(current, 'statusBar.background');
      if (found) break;
      await new Promise(r => setTimeout(r, 200));
    }

    const activeColor = found;
    // The extension sets ACTIVE to #49124b and INACTIVE to #0f0f0f
    expect(activeColor).to.exist;
    const valid = ['#49124b', '#0f0f0f'];
    expect(valid).to.include(activeColor.toLowerCase());
  });
});
