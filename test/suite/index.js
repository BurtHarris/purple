const path = require('path');
const Mocha = require('mocha');
const glob = require('glob');

function run() {
  const mocha = new Mocha({ ui: 'bdd', timeout: 60000 });
  const testsRoot = path.resolve(__dirname);
  // Add all test files in this folder
  let testFiles = glob.sync('**/*.test.js', { cwd: testsRoot });
  // By default exclude smoke tests unless RUN_SMOKE env var is set
  const runSmoke = (process.env.RUN_SMOKE === '1' || String(process.env.RUN_SMOKE).toLowerCase() === 'true');
  if (!runSmoke) {
    testFiles = testFiles.filter(f => !f.includes('smoke') && !f.startsWith('smoke'));
  }
  testFiles.forEach(f => mocha.addFile(path.join(testsRoot, f)));
  return new Promise((c, e) => {
    try {
      mocha.run(failures => {
        return failures ? e(new Error(`${failures} tests failed.`)) : c();
      });
    } catch (err) {
      e(err);
    }
  });
}

module.exports = { run };
