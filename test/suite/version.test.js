const { expect } = require('chai');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

describe('Version sync test', function() {
  this.timeout(60000);

  it('diagnose reports the same version as package.json', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    expect(ext).to.exist;
    await ext.activate();
    expect(ext.isActive).to.be.true;

    // call the diagnose command which now returns runtime info
    const info = await vscode.commands.executeCommand('rivershade.diagnose');
    expect(info).to.be.an('object');

    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.version).to.equal(info.version);
  });
});
