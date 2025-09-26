Developer workflow and commands

Quick commands

- Install deps
  - npm install

- Lint
  - npm run lint

- Run extension integration tests (downloads VS Code and runs harness)
  - npm run test

- Run only unit tests (fast, no VS Code host)
  - npx mocha "test/unit/*.test.js"

Test scripts (npm)

- Default (unit tests only):
  - npm test

- Run unit tests explicitly:
  - npm run test:unit

- Run integration tests (launches the VS Code test host):
  - npm run test:integration

- Run integration + smoke tests (sets RUN_SMOKE):
  - npm run test:smoke

Notes

- By default the test harness will not launch the VS Code Extension Development Host — that only happens for `test:integration` or `test:smoke`.
- To run smoke tests selectively locally you can also set the env var `RUN_SMOKE=1` before running the integration command.

Debugging

- Launch extension in Extension Development Host: press F5 in VS Code (ensure Debug config 'Run Extension' is present)
- Debug extension tests: choose 'Extension Tests' debug config and start debug session.

Webview guidance (repo-specific)

- Use `webview.asWebviewUri` for local resources and set `localResourceRoots` to restrict access.
- Add a strict Content Security Policy using `webview.cspSource` and avoid inline scripts/styles.
- Use `postMessage` and `onDidReceiveMessage` for webview ↔ extension comms; persist small state with `vscode.setState` and implement `WebviewPanelSerializer` if you need restore-on-restart.

CI notes

- CI will run `npm ci`, `npm run lint` and unit tests. Integration tests are heavier and are optional in CI.

Tips

- Keep pure logic in `lib/` and test it with unit tests.
- Keep `extension.js` thin: lazy-initialize heavy subsystems when commands are executed.
