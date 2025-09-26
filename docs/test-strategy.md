# Test Strategy — refactored colorPicker

This document describes a pragmatic, testable strategy for the refactored `lib/colorPicker` modules. It focuses on small, fast unit tests for each module and a small set of integration/smoke tests that prove the end-to-end behavior in a VS Code test host.

Goals
- High confidence in module correctness via unit tests that exercise logic in isolation.
- One or two smoke/integration tests that exercise extension activation and the message flows (preview, ok, cancel) inside the VS Code test host.
- Fast feedback: unit tests run on every push; integration tests run on a nightly build or on-demand (PR gate optional depending on CI budget).

Test types and placement
- Unit tests (fast, Node-only)
  - Location: `test/unit/` (existing pattern in the repo)
  - Run by `npm test` locally and in CI.
  - Targets: `htmlLoader`, `presetMapper`, `previewScheduler`, `configWriter`, `messageHandler`.
  - Use dependency injection to avoid `vscode` dependency: inject `asWebviewUri` helper, fake `cfg` objects, and fake panels.

- Integration / smoke tests (slower, run in VS Code test host)
  - Location: `test/suite/` (follow repository's existing integration harness)
  - Run by `npm run test:integration` or a CI job using `vscode-test` harness.
  - Targets: extension activation, command registration, open panel and basic message roundtrip (preview->verify settings changed, cancel->verify restore, ok->verify persist).
  - Keep the suite small and focused — these are more brittle and slower.

Unit test matrix (modules and suggested tests)

1) htmlLoader
- Tests
  - Returns raw HTML when no asWebviewUri helper provided.
  - Rewrites `<script src=...>`, `<link href=...>`, `<img src=...>` to webview URIs when `asWebviewUri` is provided (verify returned URIs match the helper's output).
  - Leaves absolute URLs, data URIs, mailto, and root-absolute paths untouched.
  - Injects CSP meta when missing; leaves existing CSP meta intact.
- Mocks: small fake media directory fixture and a stub `asWebviewUri` that returns a predictable URI.

2) paletteMapper
- Tests
  - Maps a minimal palette to expected keys (titleBar.activeBackground, statusBar.background, etc.).
  - Applies `helpers.filterAllowedKeys` behaviour (mock `helpers.filterAllowedKeys` to assert interaction)
  - Border blending: if mapper calls `helpers.blendOKLCHSafe`, inject a stub to assert it was called for correct keys.
- Mocks: inject a fake `helpers` that has predictable outputs.

3) previewScheduler
- Tests
  - Debounce: schedule() called multiple times within the debounce window invokes underlying `writeFn` only once with latest value.
  - flush(): immediately calls `writeFn` if pending.
  - dispose(): cancels pending timers and subsequent schedule calls are ignored.
- Mocks: stub `writeFn` with an async spy.

4) configWriter
- Tests
  - `snapshotTargets` returns the expected mapping by stubbing `cfg.inspect`.
  - `writeToTarget` merges preview mapping with existing inspect values and calls `cfg.update` with merged object (or undefined if empty).
  - `restoreTargets` calls `cfg.update` with originals.
- Mocks: fake `cfg` with `inspect`, `get`, and an async `update` that records calls.

5) messageHandler
- Tests
  - `preview` message: calls mapper and schedules via `scheduler.schedule` with expected mapping.
  - `ok`/`apply`: calls `cfgWriter.writeToTarget` for each configured target and sets persisted; verifies `panel.dispose` is called.
  - `cancel`: calls cfgWriter.restoreTargets with the provided `originals` and calls `panel.dispose`.
  - `syncRequest`: posts a `sync` message to `panel.webview.postMessage` with the configuration snapshot.
- Mocks: inject a fake `panel` (with `webview.postMessage` spy and `dispose` spy), `cfgWriter` stub, `mapper` stub, `scheduler` spy, and `originals` object.

Integration / smoke tests

Keep the integration suite narrow. These tests run inside the VS Code Test Runner and exercise the real `vscode` API.

1) Activation / command registration
- Ensure extension activates and registers the `rivershade.openPreview` command.
- Acceptance: command exists in `vscode.commands.getCommands(true)`.

2) Open panel happy-path (smoke)
- Execute `rivershade.openPreview` to open the panel.
- Use the test harness to get the extension's exported `openColorPicker` result (or simulate messages) and assert the panel opens.
- Send a `syncRequest` message and assert the test harness receives a `sync` postMessage with expected shape.

3) Preview -> Cancel flow
- Send a `preview` message with a small palette.
- Assert that `workspace.getConfiguration().inspect('workbench.colorCustomizations')` reflects the preview mapping for the configured target (global or workspace depending on settings).
- Send `cancel` message and assert original values restored.

4) Preview -> OK flow
- Send `preview` then `ok` and assert the changes persisted and not restored on panel dispose.

Testing helpers and mocks
- Create `lib/colorPicker/index.test-helpers.js` (already added skeleton) with functions:
  - `makeFakePanel()` with `webview.postMessage` spy and `dispose` behavior.
  - `makeFakeCfg()` that tracks `inspect` and `update` calls and supports injection of initial values.
- These helpers are used by unit tests to avoid instantiating `vscode`.

Test data and fixtures
- Create `test/fixtures/media/` with a small `preset-preview.html` used by `htmlLoader` tests. Keep it minimal and deterministic.
- Use small palette JSON fixtures for mapping tests under `test/fixtures/palettes/`.

CI recommendations
- Run unit tests on every push/PR (fast). Use the repo's existing `npm test` target.
- Run integration tests selectively: nightly or on-demand (they require VS Code Test host and are slow). If CI budget allows, mark them as optional or run them in a separate workflow.

Commands (PowerShell)
- Run unit tests:

```powershell
npm test
```

- Run integration tests (slower):

```powershell
npm run test:integration
```

Observability and flakiness
- Keep integration tests small to avoid flake.
- Use retries conservatively (CI may rerun the job once on failure before triaging test breakdown).
- Capture and persist logs from the VS Code test host to the CI artifacts for debugging failures.

Acceptance criteria
- Unit tests cover > 80% of the refactored module logic (goal, not mandatory for first pass).
- Integration smoke tests reliably assert activation, command availability, and basic preview/ok/cancel flows.
- The message contract between the webview and the host is fully covered by unit tests for `messageHandler` and the integration tests for correctness in a real host.

Migration steps and timeline
1. Add unit tests for `htmlLoader`, `previewScheduler`, and `configWriter` (these are strictly Node-only and fast).
2. Add tests for `messageHandler` using the `index.test-helpers` mocks.
3. Add a small integration smoke test to exercise activation and open-panel behavior.
4. Expand tests for `paletteMapper` and any color blending logic once implemented.

Notes
- Because the refactor splits responsibilities, most logic becomes straightforward to unit-test without the VS Code runtime. Favor injecting helpers and writing narrowly-scoped tests per module.
- If you want I can begin implementing the first batch of unit tests (htmlLoader + previewScheduler + configWriter) and run them; tell me to proceed and I'll add tests and run `npm test`.

---

Document created on: 2025-09-26
