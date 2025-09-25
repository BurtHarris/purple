const path = require('path');
const Mocha = require('mocha');
const glob = require('glob');

function run() {
  const mocha = new Mocha({ ui: 'bdd', timeout: 60000 });
  const testsRoot = path.resolve(__dirname);
  // Add all test files in this folder
  const testFiles = glob.sync('**/*.test.js', { cwd: testsRoot });
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
