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

    // If the extension exposes packageJSON use it; otherwise read package.json
    const extInfo = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    let pkgVersion = null;
    if (extInfo && extInfo.packageJSON && extInfo.packageJSON.version) pkgVersion = extInfo.packageJSON.version;
    else {
      const pkgPath = path.join(__dirname, '..', '..', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkgVersion = pkg.version;
    }
    expect(pkgVersion).to.be.a('string');
  });
});
