/* lib/paletteEditor/configWriter.js */
module.exports.createConfigWriter = function createConfigWriter({ cfg, vscode } = {}) {
  const inspectKey = 'workbench.colorCustomizations';

  const inspectBaseForTarget = (t) => {
    const inspect = cfg.inspect(inspectKey) || {};
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
