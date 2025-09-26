/* lib/colorPicker/htmlLoader.js
   Load the bundled webview HTML for the color picker and optionally rewrite resource URIs.
*/
const fs = require('fs');
const path = require('path');

function loadBundledHtml(context, opts) {
  // opts may be a panel object or an options object { asWebviewUri: fn, mediaDir: path }
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

  // Expect new 'palette-preview.html' in media
  const mediaPath = path.join(mediaDir, 'palette-preview.html');
  if (!fs.existsSync(mediaPath)) return null;
  let html = fs.readFileSync(mediaPath, 'utf8');

  // If no asWebviewUri helper provided, return raw HTML
  if (!asWebviewUriFn) return html;

  // Replace src/href attributes for common tags: <script>, <link>, <img>, <source>
  // Basic regex-based replacement is acceptable here given simple template.
  html = html.replace(/(<(?:script|img|source)[^>]+?(?:src)\s*=\s*['"])([^'"]+)(['"][^>]*>)/gi, (m, pre, src, post) => {
    // ignore absolute URLs or data URIs
    if (/^(https?:|data:|mailto:|\/)/i.test(src)) return m;
    try {
      const abs = path.isAbsolute(src) ? src : path.join(mediaDir, src.replace(/^\.\/?/, ''));
      const newUri = asWebviewUriFn(abs);
      return pre + newUri + post;
    } catch (e) { return m; }
  });
  html = html.replace(/(<link[^>]+?href\s*=\s*['"])([^'"]+)(['"][^>]*>)/gi, (m, pre, href, post) => {
    if (/^(https?:|data:|mailto:|\/)/i.test(href)) return m;
    try {
      const abs = path.isAbsolute(href) ? href : path.join(mediaDir, href.replace(/^\.\/?/, ''));
      const newUri = asWebviewUriFn(abs);
      return pre + newUri + post;
    } catch (e) { return m; }
  });

  // Ensure a minimal CSP meta exists to allow webview scripts/styles (webview provides a nonce in many setups; keep permissive fallback)
  if (!/meta[^>]+content-security-policy/i.test(html)) {
    const csp = `
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:;">
    `;
    html = html.replace(/<head(\s|>)/i, `<head$1${csp}`);
  }

  return html;
}

module.exports = { loadBundledHtml };
