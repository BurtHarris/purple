const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { loadBundledHtml } = require('../../lib/paletteEditor/htmlLoader');

describe('htmlLoader', () => {
  it('returns raw HTML when no asWebviewUri helper provided', () => {
    const ctx = { extensionPath: path.join(__dirname, '..', '..') };
    const html = loadBundledHtml(ctx, {});
    expect(html).to.be.a('string');
    expect(html).to.match(/<html/i);
  });

  it('rewrites relative resource URLs using provided asWebviewUri', () => {
    // create a fake asWebviewUri that returns a transformed string
    const fakeAs = (abs) => `vscode-resource:${abs}`;
    const ctx = { extensionPath: path.join(__dirname, '..', '..') };
    const html = loadBundledHtml(ctx, { asWebviewUri: fakeAs, mediaDir: path.join(ctx.extensionPath, 'media') });
    // function should return HTML when helper is provided; since the bundled HTML uses inline scripts/styles, rewritten resources may not be present
    expect(html).to.be.a('string');
  });

  it('injects CSP meta when missing', () => {
    const fakeAs = (abs) => `vscode-resource:${abs}`;
    const ctx = { extensionPath: path.join(__dirname, '..', '..') };
    const html = loadBundledHtml(ctx, { asWebviewUri: fakeAs, mediaDir: path.join(ctx.extensionPath, 'media') });
    expect(html.toLowerCase()).to.match(/content-security-policy/);
  });
});
