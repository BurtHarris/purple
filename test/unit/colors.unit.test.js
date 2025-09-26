const { expect } = require('chai');

// This unit test avoids importing 'vscode' and exercises lib/colors.js's
// pure mapping logic via buildColorsSet by calling init with a minimal runtime.

const colorsModule = require('../../lib/colors');

describe('lib/colors unit', function() {
  it('maps preset tokens to title/status/border keys', function() {
    // Minimal runtime; buildColorsSet does not rely on the runtime internals.
    const runtime = {};
    const c = colorsModule.init(runtime);
    expect(c).to.have.property('buildColorsSet');

    const palette = {
      themePrimary: '#112233',
      themeSecondary: '#445566',
      themeTertiary: '#778899',
      neutralPrimary: '#ffffff',
      neutralSecondary: '#cccccc'
    };

    const out = c.buildColorsSet('default', { palette: palette, toggleTitleBar: true, toggleActivityBar: true, toggleStatusBar: true });

    // titleBar and statusBar keys should be present and be hex color strings
    const hexRe = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
    expect(out).to.have.property('titleBar.activeBackground');
    expect(out['titleBar.activeBackground']).to.match(hexRe);
    expect(out).to.have.property('titleBar.activeForeground');
    expect(out['titleBar.activeForeground']).to.match(hexRe);
    expect(out).to.have.property('statusBar.background');
    expect(out['statusBar.background']).to.match(hexRe);
    // borders should include at least one border key and be a hex color
    const border = out['titleBar.border'] || out['statusBar.border'] || out['sideBar.border'] || out['editorGroup.border'] || out['panel.border'];
    expect(border).to.exist;
    expect(border).to.match(hexRe);
  });
});
