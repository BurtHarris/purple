const { expect } = require('chai');
const vscode = require('vscode');

describe('Bling Customizations', function() {
  this.timeout(30000);

  it('installs bling customizations', async () => {
    await vscode.commands.executeCommand('rivershade.installBling');
    const cfg = vscode.workspace.getConfiguration();
    const current = cfg.get('workbench.colorCustomizations') || {};
  // Check for a key unique to bling (updated to dark variant value)
  expect(current['titleBar.activeBackground']).to.equal('#49124b');
  expect(current['activityBar.background']).to.equal('#3a0e3c');
  expect(current['statusBar.background']).to.equal('#49124b');
  });

  it('removes bling customizations', async () => {
    await vscode.commands.executeCommand('rivershade.installBling');
    await vscode.commands.executeCommand('rivershade.removeBling');
    const cfg = vscode.workspace.getConfiguration();
    const current = cfg.get('workbench.colorCustomizations') || {};
    // Should not have bling keys
    expect(current['titleBar.activeBackground']).to.not.equal('#49124b');
    expect(current['activityBar.background']).to.not.equal('#49124b');
    expect(current['statusBar.background']).to.not.equal('#49124b');
  });
});
