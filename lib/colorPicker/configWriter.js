/* lib/colorPicker/configWriter.js
   Encapsulate reads and writes to workbench.colorCustomizations and snapshot/restore behavior.
   createConfigWriter({ cfg, vscode }) => { writeToTarget, snapshotTargets, restoreTargets, inspectBaseForTarget }
*/

module.exports.createConfigWriter = function createConfigWriter({ cfg, vscode } = {}) {
  const inspectKey = 'workbench.colorCustomizations';

  const inspectBaseForTarget = (t) => {
    const inspect = cfg.inspect(inspectKey) || {};
    // debug
    // console.log('DBG inspectBaseForTarget t=', t, 'inspect=', inspect);
    if (!inspect) return undefined;
    if (t === (vscode && vscode.ConfigurationTarget && vscode.ConfigurationTarget.Global)) return inspect.globalValue || inspect.globalLocalValue || undefined;
    if (t === (vscode && vscode.ConfigurationTarget && vscode.ConfigurationTarget.Workspace)) return inspect.workspaceValue || inspect.workspaceFolderValue || undefined;
    return undefined;
  };

  const writeToTarget = async (t, obj) => {
    const currentInspect = cfg.inspect(inspectKey) || {};
    const currentForTarget = (t === vscode.ConfigurationTarget.Global) ? (currentInspect.globalValue || currentInspect.globalLocalValue || undefined) : (currentInspect.workspaceValue || currentInspect.workspaceFolderValue || undefined);
    const existing = currentForTarget || {};
    const clone = Object.assign({}, existing, obj);
    const valueToSet = Object.keys(clone).length === 0 ? undefined : clone;
    try { await cfg.update(inspectKey, valueToSet, t); } catch (e) { /* ignore errors */ }
  };

  const snapshotTargets = (targets = []) => {
    const map = {};
    for (const t of targets) {
      const val = inspectBaseForTarget(t);
      // debug: show what we're capturing (removed after debugging)
      // console.log('DBG snapshotTargets t=', t, 'val=', val);
      // shallow clone to avoid accidental mutation
      map[String(t)] = (val && typeof val === 'object') ? Object.assign({}, val) : val;
    }
    return map;
  };

  const restoreTargets = async (targetMap = {}) => {
    for (const tStr of Object.keys(targetMap)) {
      const t = isNaN(Number(tStr)) ? tStr : Number(tStr);
      const val = targetMap[tStr];
      try { await cfg.update(inspectKey, val, t); } catch (e) { /* ignore */ }
    }
  };

  return { writeToTarget, snapshotTargets, restoreTargets, inspectBaseForTarget };
};
