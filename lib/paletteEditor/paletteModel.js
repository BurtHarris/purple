
/**
 * @file Palette data model
 * @description Small class that holds three palette colors and provides
 * normalization and validation helpers. JSDoc typedefs below give editors
 * TypeScript-like types when working in JS projects.
 */

/**
 * @typedef {Object} PaletteShape
 * @property {string|null} [themePrimary]
 * @property {string|null} [themeSecondary]
 * @property {string|null} [themeTertiary]
 */

/**
 * Palette model encapsulates the palette colors and small utility methods.
 */
class Palette {
  /**
   * @param {PaletteShape} [opts]
   */
  constructor({ themePrimary, themeSecondary, themeTertiary } = {}) {
    /** @type {string|null} */
    this.themePrimary = themePrimary || null;

    /** @type {string|null} */
    this.themeSecondary = themeSecondary || null;

    /** @type {string|null} */
    this.themeTertiary = themeTertiary || null;
  }

  /**
   * Normalize a color token when it's a simple hex string. Expands 3-digit hex
   * to 6-digit and lowercases. If input is falsy returns null. Otherwise returns
   * the original string for formats we don't specially handle.
   * @param {string|null|undefined} c
   * @returns {string|null}
   */
  normalizeColor(c) {
    if (!c) return null;
    const s = String(c).trim();
    const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let hex = m[1].toLowerCase();
      if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
      return `#${hex}`;
    }
    return s;
  }

  /**
   * Normalize all palette fields in-place and return this instance.
   * @returns {Palette}
   */
  normalize() {
    this.themePrimary = this.normalizeColor(this.themePrimary);
    this.themeSecondary = this.normalizeColor(this.themeSecondary);
    this.themeTertiary = this.normalizeColor(this.themeTertiary);
    return this;
  }

  /**
   * Return true when at least one meaningful color is set.
   * @returns {boolean}
   */
  isValid() {
    return !!(this.themePrimary || this.themeSecondary || this.themeTertiary);
  }

  /**
   * Return a shallow POJO representation.
   * @returns {PaletteShape}
   */
  toPlain() {
    return { themePrimary: this.themePrimary, themeSecondary: this.themeSecondary, themeTertiary: this.themeTertiary };
  }
}

module.exports = { Palette };
