# Website HTTPS and security headers — #148

Deployment runbook for the future public website; these settings are not yet deployed. The current AWS media stack blocks public bucket access, enforces SSL at S3 and redirects CloudFront viewers to HTTPS (`infra/lib/media-stack.ts`). A media distribution is not proof that the future HTML website has these protections.

## HTTPS

Use the chosen host's managed, automatically renewed certificate for every production/custom hostname. Redirect HTTP to HTTPS, serve all app/API/media links over HTTPS and use `wss://` for Supabase Realtime. Require TLS 1.2 or newer (prefer 1.3). Set Supabase's production Site URL and exact redirect allowlist for the real web origin and app callback; do not copy localhost, Expo wildcard redirects or test auth settings from the local config. Never run `supabase config push` from local development.

Start HSTS only after every covered hostname works over HTTPS: `Strict-Transport-Security: max-age=31536000`. Add `includeSubDomains` only once every subdomain is ready; do not request preload without reviewing the long-term domain commitment and recovery path.

## Response headers

Apply headers to HTML/error/auth-callback responses through the hosting response-header mechanism. Verify real headers after redirects and on 404s, not just a checked-in config. Use these starting values:

| Header | Starting policy |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin`; use `no-referrer` for bearer-token/action-link pages |
| `X-Frame-Options` | `DENY` (also set CSP `frame-ancestors 'none'`) |
| `Permissions-Policy` | Disable unused features; for example `camera=(), microphone=(), payment=(), geolocation=(self)` on marketing pages. Override deliberately for pages that actually need microphone/payment capabilities. |
| `Cache-Control` | `no-store` for token-bearing callbacks, private account responses and email action pages; cache only public immutable assets |
| `Strict-Transport-Security` | As above, after HTTPS validation |

Roll out Content Security Policy in **Report-Only** first and exercise every route before enforcing. Derive the smallest real allowlist from the production export and network requests. Do not paste a wildcard policy. A starting template (replace angle-bracket hosts) is:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
script-src 'self' https://challenges.cloudflare.com;
connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co https://challenges.cloudflare.com;
img-src 'self' data: blob: https://<media-host> https://<project>.supabase.co;
font-src 'self'; style-src 'self';
frame-src https://challenges.cloudflare.com; form-action 'self'; upgrade-insecure-requests
```

This is a template, not a working allowlist for every Wedded flow. Expo's exported bootstrap/inline styles may require exact hashes/nonces or a reviewed style exception; do not add `unsafe-eval` or broad script `unsafe-inline` as a shortcut. Payments may require Stripe script/frame/connect origins: scope them to payment pages. Approved social embeds require their exact provider origins and a privacy decision; otherwise omit/block them. Blob media and device permissions require route-specific review. Keep Supabase/Stripe/Turnstile secrets out of scripts and public environment variables. CORS is not an authentication mechanism; Edge APIs still verify caller credentials/signatures.

## Acceptance before publishing

Check HTTP→HTTPS redirects, valid hostname/certificate/renewal, no mixed content, HSTS coverage and response headers with `curl -I` and browser devtools. Exercise sign-in/callback, initial code and resend challenges, sign-out, unsubscribe confirmation/POST/resume, media, Realtime, permissions and payment return flows on web and mobile. Review CSP reports and remove unintended third-party requests before enforcing. Never log full auth callbacks, signed email-link URLs, secret headers or CAPTCHA tokens in production request logs. Founders/website owner own deployment verification under #148.

References: [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [MDN HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security), [Cloudflare Turnstile CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).
