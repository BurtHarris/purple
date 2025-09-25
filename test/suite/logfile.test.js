const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

describe('Activation logfile', function() {
  this.timeout(30000);

  it('writes activation artifact', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    expect(ext).to.exist;
    await ext.activate();
    expect(ext.isActive).to.be.true;

    const workspaceRoot = path.resolve(__dirname, '..', '..');
    const logDir = path.join(workspaceRoot, '.vscode-test', 'logs');
    const logFile = path.join(logDir, 'rivershade-activation.json');

    // Wait up to 10s for the file to appear
    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (fs.existsSync(logFile)) break;
      await new Promise(r => setTimeout(r, 200));
    }

    expect(fs.existsSync(logFile)).to.be.true;

    const content = fs.readFileSync(logFile, 'utf8');
    let json = null;
    try {
      json = JSON.parse(content);
    } catch (e) {
      expect.fail('Activation log is not valid JSON');
    }

    expect(json.activatedAt).to.exist;
    expect(json.theme).to.exist;
  });
});
