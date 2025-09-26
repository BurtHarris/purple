const { expect } = require('chai');
const ch = require('../../lib/colorHelpers');

describe('colorHelpers', () => {
  it('converts hex to rgb and back', () => {
    const hex = '#7a4ccf';
    const rgb = ch.hexToRgb(hex);
    expect(rgb).to.have.keys(['r','g','b']);
    const round = ch.rgbToHex(rgb);
    expect(round.toLowerCase()).to.equal(hex);
  });

  it('filters allowed keys', () => {
    const mapping = { 'titleBar.activeBackground': '#fff', 'unrelated.key': '#000' };
    const out = ch.filterAllowedKeys(mapping);
    expect(out['titleBar.activeBackground']).to.equal('#fff');
    expect(out['unrelated.key']).to.be.undefined;
  });

  it('blends fallback rgb when colorjs missing', () => {
    const a = '#000000';
    const b = '#ffffff';
    const mid = ch.blendOKLCHSafe(a, b, 0.5);
    expect(mid).to.match(/^#[0-9a-fA-F]{6}$/);
  });
});
