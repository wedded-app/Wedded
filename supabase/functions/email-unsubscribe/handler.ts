import { createClient } from '@supabase/supabase-js';
import { verifiedEmail } from '../_shared/email-links.ts';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function page(title: string, content: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Wedded email preferences</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F2F2F7;
font:18px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1C1C1E}
main{max-width:420px;padding:32px 24px;text-align:center;overflow-wrap:anywhere}
h1{font-size:26px;color:#8E1537}button{font:inherit;background:#8E1537;color:white;
border:0;border-radius:8px;padding:12px 20px;cursor:pointer}</style></head>
<body><main><h1>${escapeHtml(title)}</h1>${content}</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

function form(action: 'stop' | 'resume', label: string): string {
  return `<form method="post"><button name="action" value="${action}">${label}</button></form>`;
}

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return page('Method not allowed', '<p>Use the link in your email.</p>', 405);
  }
  try {
    const params = new URL(request.url).searchParams;
    const email = await verifiedEmail(params.get('e'), params.get('t'));
    if (!email) {
      return page('Invalid email link', '<p>Use the original link in your email.</p>', 400);
    }
    if (request.method === 'GET') {
      return page(`Stop emails to ${email}?`, form('stop', 'Stop emails'));
    }
    const body = new URLSearchParams(await request.text());
    const action = body.get('List-Unsubscribe') === 'One-Click' ? 'stop' : body.get('action');
    if (action !== 'stop' && action !== 'resume') {
      return page('Invalid request', '<p>Choose Stop emails or Start emails again.</p>', 400);
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = action === 'stop'
      ? await admin.from('email_opt_outs').upsert({ email }, {
        onConflict: 'email',
        ignoreDuplicates: true,
      })
      : await admin.from('email_opt_outs').delete().eq('email', email);
    if (error) throw error;
    return action === 'stop'
      ? page(
        "You're unsubscribed",
        `<p>Emails to ${escapeHtml(email)} are stopped.</p>${form('resume', 'Start emails again')}`,
      )
      : page(
        'Emails started again',
        `<p>You can receive Wedded emails at ${escapeHtml(email)}.</p>${
          form('stop', 'Stop emails')
        }`,
      );
  } catch {
    return page(
      'Please try again',
      '<p>We could not save your email preference. Try again shortly.</p>',
      503,
    );
  }
}
