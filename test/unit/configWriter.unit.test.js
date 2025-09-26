const { expect } = require('chai');
const { createConfigWriter } = require('../../lib/paletteEditor/configWriter');
const { makeFakeCfg } = require('../../lib/paletteEditor/index.test-helpers');

describe('configWriter', () => {
  it('snapshots and restores targets correctly', async () => {
    const cfg = makeFakeCfg();
    // pre-populate with some value
    await cfg.update('workbench.colorCustomizations', { 'titleBar.activeBackground': '#112233' }, 1);
    const vscode = { ConfigurationTarget: { Global: 1, Workspace: 2 } };
    const cw = createConfigWriter({ cfg, vscode });
    const snap = cw.snapshotTargets([vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace]);
    expect(snap).to.have.property('1');
    expect(snap['1']).to.deep.equal({ 'titleBar.activeBackground': '#112233' });

    // modify and restore
    await cw.writeToTarget(vscode.ConfigurationTarget.Global, { 'titleBar.activeBackground': '#ffffff' });
    expect(cfg.inspect('workbench.colorCustomizations').globalValue['titleBar.activeBackground']).to.equal('#ffffff');
    await cw.restoreTargets(snap);
    expect(cfg.inspect('workbench.colorCustomizations').globalValue['titleBar.activeBackground']).to.equal('#112233');
  });

  it('inspectBaseForTarget returns undefined for missing targets', () => {
    const cfg = makeFakeCfg();
    const vscode = { ConfigurationTarget: { Global: 1, Workspace: 2 } };
    const cw = createConfigWriter({ cfg, vscode });
    const v = cw.inspectBaseForTarget(vscode.ConfigurationTarget.Workspace);
    expect(v).to.be.undefined;
  });
});
