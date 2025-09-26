#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { return null; }
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

function backupFile(filePath) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = filePath + '.bak.' + ts;
  fs.copyFileSync(filePath, dest);
  return dest;
}

function removeColorCustomizationsFromObject(obj) {
  let removed = false;
  if (!obj || typeof obj !== 'object') return removed;
  if (Object.prototype.hasOwnProperty.call(obj, 'workbench.colorCustomizations')) {
    delete obj['workbench.colorCustomizations'];
    removed = true;
  }
  // Also remove inside theme-scoped keys like "[Default Dark+]": { ... }
  for (const k of Object.keys(obj)) {
    if (/^\[.*\]$/.test(k) && obj[k] && typeof obj[k] === 'object') {
      if (Object.prototype.hasOwnProperty.call(obj[k], 'workbench.colorCustomizations')) {
        delete obj[k]['workbench.colorCustomizations'];
        removed = true;
        // if the theme object becomes empty, leave it alone (user may rely on other overrides)
      }
    }
  }
  return removed;
}

function findCommonUserSettingsPaths() {
  const candidates = [];
  const appdata = process.env.APPDATA;
  if (appdata) {
    candidates.push(path.join(appdata, 'Code', 'User', 'settings.json'));
    candidates.push(path.join(appdata, 'Code - Insiders', 'User', 'settings.json'));
    candidates.push(path.join(appdata, 'Code - OSS', 'User', 'settings.json'));
    // VS Code Portable uses a Data\user\settings.json inside installation folder; cannot guess.
  }
  // mac/linux alternatives (in case someone runs this cross-platform)
  const home = process.env.HOME || process.env.USERPROFILE || null;
  if (home) {
    candidates.push(path.join(home, '.config', 'Code', 'User', 'settings.json'));
    candidates.push(path.join(home, '.config', 'Code - Insiders', 'User', 'settings.json'));
  }
  return candidates;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
  const paths = findCommonUserSettingsPaths();
  let anyFound = false;
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      anyFound = true;
      console.log('Found settings file:', p);
      const obj = readJson(p);
      if (!obj) { console.warn('  Could not parse JSON, skipping'); continue; }
      const removed = removeColorCustomizationsFromObject(obj);
      if (!removed) { console.log('  No color customizations found to remove.'); continue; }
      if (dryRun) { console.log('  Dry-run: would remove workbench.colorCustomizations.'); continue; }
      const bak = backupFile(p);
      writeJson(p, obj);
      console.log('  Removed color overrides and backed up original to', bak);
    } catch (e) {
      console.error('  Error processing', p, e && e.message);
    }
  }
  if (!anyFound) console.log('No common VS Code user settings files found on this machine.');
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { removeColorCustomizationsFromObject, findCommonUserSettingsPaths };
