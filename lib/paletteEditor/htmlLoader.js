// Copied from lib/colorPicker/htmlLoader.js
const fs = require('fs');
const path = require('path');

function loadBundledHtml(context, opts) {
  const mediaDirDefault = path.join(context.extensionPath || __dirname, 'media');
  let mediaDir = mediaDirDefault;
  let asWebviewUriFn = null;
  if (opts) {
    if (opts.webview && typeof opts.webview.asWebviewUri === 'function') {
      asWebviewUriFn = (abs) => opts.webview.asWebviewUri(abs).toString();
    }
    if (typeof opts.asWebviewUri === 'function') asWebviewUriFn = opts.asWebviewUri;
    if (opts.mediaDir) mediaDir = opts.mediaDir;
  }

  const mediaPath = path.join(mediaDir, 'palette-preview.html');
  if (!fs.existsSync(mediaPath)) return null;
  let html = fs.readFileSync(mediaPath, 'utf8');
  if (!asWebviewUriFn) return html;

  html = html.replace(/(<(?:script|img|source)[^>]+?(?:src)\s*=\s*['"])([^'"]+)(['"][^>]*>)/gi, (m, pre, src, post) => {
    if (/^(https?:|data:|mailto:|\/)/i.test(src)) return m;
    try {
      const abs = path.isAbsolute(src) ? src : path.join(mediaDir, src.replace(/^\.\/?/, ''));
      const newUri = asWebviewUriFn(abs);
      return pre + newUri + post;
    } catch (e) { return m; }
  });
  html = html.replace(/(<link[^>]+?href\s*=\s*['"])([^'"]+)(['"][^>]*>)/gi, (m, pre, href, post) => {
    if (/^(https?:|data:|mailto:|\/)/i.test(href)) return m;
    try { const abs = path.isAbsolute(href) ? href : path.join(mediaDir, href.replace(/^\.\/?/, '')); const newUri = asWebviewUriFn(abs); return pre + newUri + post; } catch (e) { return m; }
  });

  if (!/meta[^>]+content-security-policy/i.test(html)) {
    const csp = `\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:;">\n    `;
    html = html.replace(/<head(\s|>)/i, `<head$1${csp}`);
  }

  return html;
}

module.exports = { loadBundledHtml };
