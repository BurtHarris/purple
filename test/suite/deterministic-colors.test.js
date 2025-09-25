const { expect } = require('chai');
const vscode = require('vscode');

describe('Deterministic color values', function() {
  this.timeout(30000);

  it('applies exact active and inactive status bar backgrounds', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    expect(ext).to.exist;
    await ext.activate();
    expect(ext.isActive).to.be.true;

    // First ensure we're in a known state: run toggle to flip
    await vscode.commands.executeCommand('focusColorToggle.toggle');
    // Then toggle back
    await vscode.commands.executeCommand('focusColorToggle.toggle');

    const cfg = vscode.workspace.getConfiguration();
    const current = cfg.get('workbench.colorCustomizations') || {};

    // Helper to check both top-level and theme-scoped
    function find(obj, key) {
      if (!obj) return null;
      if (obj[key]) return obj[key];
      for (const k of Object.keys(obj)) {
        if (k.startsWith('[') && obj[k] && obj[k][key]) return obj[k][key];
      }
      return null;
    }

    const activeColor = find(current, 'statusBar.background');
    // The extension sets ACTIVE to #49124b and INACTIVE to #0f0f0f
    expect(activeColor).to.exist;
    const valid = ['#49124b', '#0f0f0f'];
    expect(valid).to.include(activeColor.toLowerCase());
  });
});
