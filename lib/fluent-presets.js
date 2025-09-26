/**
 * Predefined Fluent-style color presets.
 * Each preset is a small set of commonly useful Fluent tokens (hex strings)
 * that can be mapped into VS Code chrome keys.
 */

export const PRESETS = {
  'fluent-purple': {
    // Tuned for dark theme: darker surfaces, lighter text neutrals and a brighter accent
    themePrimary: '#7A4CCF',
    // Complementary accent tones for UI elements that need a secondary/tertiary accent
    themeSecondary: '#5B2FA6',
    themeTertiary: '#9B63E6',
    white: '#FFFFFF',
    black: '#000000',
    // Foreground / text tones (lighter for use on dark backgrounds)
    neutralPrimary: '#E6E1F1',
    neutralSecondary: '#CFC6E6',
    neutralTertiary: '#A99FC6',
    // Surface / background tones (darker for a dark theme)
    neutralLight: '#2B2330',
    neutralLighter: '#34283A',
    neutralQuaternaryAlt: '#3C3244'
  }
};

export default PRESETS;
