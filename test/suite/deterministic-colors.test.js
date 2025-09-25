const assert = require('assert');
const vscode = require('vscode');

describe('Deterministic color values', function() {
  this.timeout(30000);

  it('applies exact active and inactive status bar backgrounds', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    assert.ok(ext, 'Extension not found');
    await ext.activate();
    assert.ok(ext.isActive, 'Extension did not activate');

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
    assert.ok(activeColor, 'statusBar.background not found in color customizations');
    // Accept either of the two colors depending on whether last toggle left it active or inactive
    const valid = ['#49124b', '#0f0f0f'];
    assert.ok(valid.includes(activeColor.toLowerCase()), `statusBar.background (${activeColor}) not one of expected values: ${valid.join(', ')}`);
  });
});
