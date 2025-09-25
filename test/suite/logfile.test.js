const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

describe('Activation logfile', function() {
  this.timeout(30000);

  it('writes activation artifact', async () => {
    const ext = vscode.extensions.getExtension('local.rivershade') || vscode.extensions.getExtension('local.vscode-focus-color-toggle');
    assert.ok(ext, 'Extension not found');
    await ext.activate();
    assert.ok(ext.isActive, 'Extension did not activate');

    const workspaceRoot = path.resolve(__dirname, '..', '..');
    const logDir = path.join(workspaceRoot, '.vscode-test', 'logs');
    const logFile = path.join(logDir, 'rivershade-activation.json');

    // Wait up to 10s for the file to appear
    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (fs.existsSync(logFile)) break;
      await new Promise(r => setTimeout(r, 200));
    }

    assert.ok(fs.existsSync(logFile), `Activation log not found at ${logFile}`);

    const content = fs.readFileSync(logFile, 'utf8');
    let json = null;
    try {
      json = JSON.parse(content);
    } catch (e) {
      assert.fail('Activation log is not valid JSON');
    }

    assert.ok(json.activatedAt, 'activatedAt missing in activation log');
    assert.ok(json.theme, 'theme missing in activation log');
  });
});
