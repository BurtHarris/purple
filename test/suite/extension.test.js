const assert = require('assert');
const vscode = require('vscode');

describe('Extension Tests', function() {
  this.timeout(60000);

  it('activates without error', async () => {
    // look for the new id first, fall back to the old id for compatibility
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    assert.ok(ext, 'Extension not found');
    await ext.activate();
    assert.ok(ext.isActive, 'Extension failed to activate');
  });
});
