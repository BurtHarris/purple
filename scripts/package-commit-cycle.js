#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function safe(cmd) {
  try {
    console.log('> ' + cmd);
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error('Command failed (continuing):', cmd);
    return false;
  }
}

// 1) Pre-package commit (best-effort)
safe('git add -A');
safe('git commit -m "chore(pre-package): snapshot before packaging"');

// 2) Bump patch version
if (!safe('npm run bump-patch')) process.exitCode = 1;

// 3) Package
if (!safe('pnpm exec vsce package')) process.exitCode = 1;

// 4) Post-package commit including bumped package.json (and vsix if desired)
let version = '<unknown>';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  version = pkg.version || version;
} catch (e) { /* ignore */ }

safe('git add -A');
safe(`git commit -m "chore(package): rivershade v${version}"`);

console.log('package-commit-cycle: done (version=' + version + ')');
