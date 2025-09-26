# Refactor plan: break up `lib/colorPicker.js`

Goal: decompose the current monolithic `lib/colorPicker.js` into several small modules with high cohesion and low coupling. Each module has a narrow responsibility, a small public API and clear test targets. This will make the code easier to reason about, maintain, and unit-test (without the `vscode` API).

High-level modules proposed

1. lib/colorPicker/index.js (or openColorPicker.js)
   - Responsibilities
     - Public entry point exported to `extension.js`.
     - Compose smaller modules: html loader, message handling, preview scheduler, and config writer.
     - Create and configure the webview panel.
     - Wire message channel between webview and message handler.
  # Overview — color picker implementation

  This repository implements a small, testable color-picker for a VS Code extension. The implementation is split into focused modules under `lib/colorPicker/`. The goal is to keep UI wiring, configuration writes, mapping logic, and scheduling separate so each part can be unit-tested without `vscode`.

  Core modules (one-line responsibility):

  - `index.js` — Controller: create the webview panel and compose the other modules.
  - `htmlLoader.js` — Load and rewrite the bundled webview HTML and inject CSP when needed.
  - `paletteMapper.js` — Map a compact palette (themePrimary/Secondary/Tertiary) to allowed `workbench.colorCustomizations` keys.
  - `previewScheduler.js` — Debounce preview writes and batch the final mapping to the writer.
  - `configWriter.js` — Snapshot/restore and merge/write `workbench.colorCustomizations` using `cfg.inspect`/`cfg.update`.
  - `messageHandler.js` — Handle webview messages (preview, apply/ok, cancel, syncRequest) and coordinate mapper/scheduler/writer.

  Design notes:

  - Dependency injection: each module accepts its runtime dependencies (helpers, cfg, vscode) so unit tests can pass fakes.
  - Merge-on-write semantics: `configWriter` merges preview mappings into existing `workbench.colorCustomizations` to avoid clobbering unrelated keys.
  - Debounced preview: `previewScheduler` prevents rapid writes by debounce (default 120ms); `flush()` is used for immediate writes on Apply/OK.
  - Error handling: modules catch and log errors; configuration writes are best-effort and won’t crash the UI.

  Typical flows:

  - Open (startup): controller loads HTML, snapshots originals, posts initial `sync` to webview, and registers the message handler.
  - Preview: webview sends `{type:'preview', palette}` → mapper → scheduler.schedule(mapping) → write occurs after debounce.
  - Apply/OK: webview sends `{type:'apply', palette}` → mapper → cfgWriter.writeToTarget(targets, mapping) → persisted flag set → panel closes.
  - Cancel / Dispose without persisted: cfgWriter.restoreTargets(originals) to revert changes.

  Testing and maintenance:

  - Unit tests cover each module (html rewriting, mapping, scheduler debounce, snapshot/restore). Tests live under `test/unit/` and run with `npm test`.
  - Integration tests (run separately) validate activation and behavior against a real VS Code test host.

  Notes:

  - A repository-wide rename from `preset` → `palette` is in progress; modules now reference `palette` names.
  - If you want a shorter or more detailed version of any section (class diagram, sequence diagrams, examples), tell me which and I’ll add it.
