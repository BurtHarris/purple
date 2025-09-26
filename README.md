Focus Color Toggle

Small extension to toggle active/inactive UI colors based on window focus. Run with F5 (Extension Development Host) to test.


> WARNING: This package is in alpha test. Only invited contributors should install or use it. Do not use in production. Packaging for other users is a future todo.

> This project was produced with assistance from GPT-5 Mini. Please review the code, tests, and configuration carefully before using in production. Do not rely solely on the generated code without verification.


Introduction

This extension changes the colors of the top, side, and bottom bars in Visual Studio Code depending on whether the VS Code window is focused (active) or not. When VS Code is the active app, the bars use a bright color. When you switch to another app, the bars use a darker color. This helps you quickly see if VS Code is the active window.

Developer notes
---------------

- The temporary `_suppressAutoApply` guard was removed; the extension now uses a single `_operationInProgress` flag to serialize operations and avoid races.
- Trace-to-disk logging has been disabled by default (TRACE_ENABLED = false) to reduce noisy artifacts during normal use.
- Packaging: the repo includes a commit-inclusive packaging helper. To package and (optionally) run the commit cycle use:

```powershell
npm run build        # alias for npm run package-cycle
npm run package-cycle
```

`package-cycle` will attempt a pre-package commit, bump the patch version, package a .vsix, and commit the package output. Only run it if you're comfortable with automatic commits.

Alpha Test Notice
-----------------

This package is in alpha test. Only invited contributors should install or use it. If you are not an invited tester, please wait for a future release. Packaging for other users is a todo item.

Usage
-----

1. Open this folder in Visual Studio Code.
2. Press F5 to launch the Extension Development Host.
3. In the new window, use the command palette (Ctrl+Shift+P) and run "Focus Color Toggle: Apply Now".
4. The title bar, activity bar, and status bar colors will change when you switch between VS Code and other apps.

If you want to change the colors, edit the `ACTIVE` and `INACTIVE` color sets in `extension.js`.

Contributing
------------

Contributions are welcome from invited testers only during alpha. To contribute:

- Fork or clone the repo and create a new branch for your changes.
- Edit `extension.js` to change which colors are updated or add new color keys.
- Run tests with `npm test` to make sure your changes work.
- Open a pull request with a clear description of what you changed and why.

To run tests:
```powershell
cd vscode-focus-toggle
npm install
npm test
```

Todo for future contributors:
- Package the extension for other users (VSIX or Marketplace)
- Add more customization options
- Improve documentation and usage examples

Focus Color Toggle

Small extension to toggle active/inactive UI colors based on window focus. Run with F5 (Extension Development Host) to test.

Testing
-------

Run the extension test suite locally:

```powershell
cd vscode-focus-toggle
npm install
npm test
```

The tests launch a disposable VS Code instance and run mocha tests against the extension.

Acknowledgement

This project (scaffolding, tests, and helper scripts) was produced with assistance from GPT-5 Mini.

Purpose
-------

This extension helps you see which app is active. When VS Code is the active app, it shows bright colors. When another app is active, it shows darker colors. This makes it easy to tell at a glance which app you are using.

Alpha Release
-------------

This project is still being tested. It may change and might not work perfectly. Only invited contributors should use it for now. If you are invited and want to help test, follow the steps in the Contributing section below.

Contributing
------------

Want to help? Thanks! Here’s how to get started:

- Install and run tests:

```powershell
cd vscode-focus-toggle
npm install
npm test
```

- Run the extension locally: open the folder in VS Code and press F5. This opens a new window where you can try the command "Focus Color Toggle: Apply Now" from the Command Palette.

- Change colors: open `extension.js` and edit the `ACTIVE` and `INACTIVE` color maps. Be careful with changes to the title bar, activity bar, and status bar colors.

- Make a branch, commit your change, and open a pull request to this repo. Use clear commit messages and include screenshots if you change colors.

TODO
----

- Package a .vsix and publish or provide an installer for invited testers.
- Add a settings page so users can pick which UI elements to change and set color values.

Settings
--------

You can control what the extension changes in your VS Code settings (Preferences → Settings). The following settings are available:

- `focusColorToggle.enabled` (boolean) — Enable or disable the extension.
- `focusColorToggle.toggleTitleBar` (boolean) — Change the title bar colors when focus changes.
- `focusColorToggle.toggleActivityBar` (boolean) — Change the activity bar colors when focus changes.
- `focusColorToggle.toggleStatusBar` (boolean) — Change the status bar colors when focus changes.

Toggle these settings on or off to pick a light or stronger focus indicator.

Usage
-----

How to try it in VS Code:

1. Open this folder in VS Code.
2. Press F5 to start the Extension Development Host.
3. In the new VS Code window, open the Command Palette (Ctrl+Shift+P) and run "Focus Color Toggle: Apply Now".
4. Click outside the window or switch apps to see the inactive colors applied.

What it changes:
- Title bar colors (active and inactive)
- Activity bar colors (active and inactive)
- Status bar colors (active and inactive)

Contributing
------------

If you want to change or improve this extension:

1. Fork the repo and clone it locally.
2. Run `npm install` to install dev tools.
3. Run `npm test` to run the test suite.
4. Edit `extension.js` to change which colors are used or which color keys are updated. The color maps are near the top of the file in `ACTIVE` and `INACTIVE` objects.
5. Add tests in `test/suite` if you change behavior.
6. Open a pull request with a clear description of your change.

Please review code carefully before using the extension in a shared or production environment.

Developer bump workflow
-----------------------

When you change contributed commands or other extension entry points you should bump the
patch version in `package.json` so tests and dev flows remain deterministic. We provide a
helper npm script for this:

```powershell
npm run bump-patch
```

This runs `npm version patch --no-git-tag-version` and updates `package-lock.json`. After
running it, commit `package.json` and `package-lock.json` to record the new version.

If you want me to bump and commit for you, say "bump and commit" and I'll do it.
