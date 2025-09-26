const { expect } = require('chai');
const vscode = require('vscode');

describe('Command Tests', function() {
  this.timeout(60000);

  it('runs toggle command without throwing', async () => {
    const config = vscode.workspace.getConfiguration();
    const key = 'workbench.colorCustomizations';
    const before = config.get(key);

  // Execute the remaining command and ensure it doesn't throw
  await vscode.commands.executeCommand('rivershade.installBling');

    // Restore previous settings if the extension changed anything
    await config.update(key, before, vscode.ConfigurationTarget.Global);
    expect(true).to.be.true; // explicit expect to make chai happy
  });
});
