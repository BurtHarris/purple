const { expect } = require('chai');
const vscode = require('vscode');

describe('Extension Tests', function() {
  this.timeout(60000);

  it('activates without error', async () => {
    // look for the new id first, fall back to the old id for compatibility
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    expect(ext).to.exist;
    await ext.activate();
    expect(ext.isActive).to.be.true;
  });
});
