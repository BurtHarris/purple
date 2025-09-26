const assert = require('assert');
const { Palette } = require('../../lib/paletteEditor/paletteModel');

describe('paletteModel', () => {
  it('normalizes 3-digit hex to 6-digit lowercase hex', () => {
    const p = new Palette({ themePrimary: '#0F8', themeSecondary: null });
    p.normalize();
    assert.strictEqual(p.themePrimary, '#00ff88');
  });

  it('preserves already normalized hex', () => {
    const p = new Palette({ themePrimary: '#abcdef' });
    p.normalize();
    assert.strictEqual(p.themePrimary, '#abcdef');
  });

  it('is valid when at least one color set', () => {
    const p = new Palette({ themePrimary: null, themeSecondary: null, themeTertiary: null });
    assert.strictEqual(p.isValid(), false);
    p.themeSecondary = '#123456';
    assert.strictEqual(p.isValid(), true);
  });
});
