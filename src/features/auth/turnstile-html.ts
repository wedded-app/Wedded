/**
 * The page the phone's web view loads for Cloudflare Turnstile. It only shows
 * a box when Cloudflare wants a tap ("interaction-only"); otherwise it passes
 * on its own. Messages back: {token}, {expired}, {error} or {interactive}.
 */
export function turnstileHtml(siteKey: string, theme: 'light' | 'dark'): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html, body { margin: 0; background: transparent; display: flex; justify-content: center; }</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready&render=explicit" async defer></script>
</head>
<body>
<div id="box"></div>
<script>
  function send(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  function ready() {
    turnstile.render('#box', {
      sitekey: ${JSON.stringify(siteKey)},
      theme: ${JSON.stringify(theme)},
      appearance: 'interaction-only',
      callback: function (token) { send({ token: token }); },
      'before-interactive-callback': function () { send({ interactive: true }); },
      'after-interactive-callback': function () { send({ interactive: false }); },
      'expired-callback': function () { send({ expired: true }); },
      'error-callback': function () { send({ error: true }); }
    });
  }
</script>
</body>
</html>`;
}
