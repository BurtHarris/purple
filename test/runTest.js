const path = require('path');
const { runTests } = require('@vscode/test-electron');
const { execSync } = require('child_process');

async function runIntegration(smoke) {
  const extensionDevelopmentPath = path.resolve(__dirname, '..');
  const extensionTestsPath = path.resolve(__dirname, 'suite');
  if (smoke) process.env.RUN_SMOKE = '1';
  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

function runUnit() {
  try {
    // Run mocha directly for unit tests
    execSync('npx mocha "test/unit/*.test.js"', { stdio: 'inherit' });
  } catch (err) {
    console.error('Unit tests failed');
    process.exit(1);
  }
}

async function main() {
  try {
    const args = process.argv.slice(2).map(a => a.toLowerCase());
    if (args.includes('--integration')) {
      await runIntegration(false);
      return;
    }
    if (args.includes('--smoke')) {
      await runIntegration(true);
      return;
    }

    // Default: run unit tests only to avoid launching VS Code unless explicitly requested
    runUnit();
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
