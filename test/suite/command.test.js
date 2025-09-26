const { expect } = require('chai');
const vscode = require('vscode');

describe('Command Tests', function() {
  this.timeout(60000);

  it('runs toggle command without throwing', async () => {
    // Ensure the new picker command is registered and can be executed (no-op if headless)
    const commands = await vscode.commands.getCommands(true);
    expect(commands).to.include('rivershade.openPreview');
    // Executing the command should not throw (it opens a webview)
    await vscode.commands.executeCommand('rivershade.openPreview');
    expect(true).to.be.true;
  });
});
