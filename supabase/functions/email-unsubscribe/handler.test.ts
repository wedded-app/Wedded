import { handleRequest } from './handler.ts';
import { signedParams } from '../_shared/email-links.ts';

function assert(value: unknown): asserts value {
  if (!value) throw new Error('Assertion failed');
}

Deno.test('GET confirms without writing; POST stop, repeat stop, one-click and resume are scoped', async () => {
  Deno.env.set('EMAIL_LINK_SECRET', 'test-key');
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  const url = `https://example.supabase.co/functions/v1/email-unsubscribe?${await signedParams(
    'family@example.com',
  )}`;
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; body: unknown; prefer: string | null }[] = [];
  let fail = false;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push({
      method: request.method,
      url: request.url,
      body: request.method === 'POST' ? await request.json() : null,
      prefer: request.headers.get('Prefer'),
    });
    return fail
      ? new Response(JSON.stringify({ message: 'database unavailable' }), { status: 500 })
      : new Response(null, { status: 204 });
  };
  try {
    const get = await handleRequest(new Request(url));
    assert(get.status === 200 && (await get.text()).includes('Stop emails to family@example.com?'));
    assert(calls.length === 0);
    assert(get.headers.get('Cache-Control') === 'no-store');
    for (const body of ['action=stop', 'action=stop', 'List-Unsubscribe=One-Click']) {
      const response = await handleRequest(new Request(url, { method: 'POST', body }));
      assert(
        response.status === 200 && (await response.text()).includes('You&#39;re unsubscribed'),
      );
    }
    assert(
      calls.every((c) => c.method === 'POST' && c.prefer?.includes('resolution=ignore-duplicates')),
    );
    assert(
      calls.every((c) =>
        JSON.stringify(c.body) === JSON.stringify({ email: 'family@example.com' })
      ),
    );
    const resume = await handleRequest(new Request(url, { method: 'POST', body: 'action=resume' }));
    assert(resume.status === 200 && (await resume.text()).includes('Emails started again'));
    assert(calls.at(-1)?.method === 'DELETE');
    assert(new URL(calls.at(-1)!.url).searchParams.get('email') === 'eq.family@example.com');
    const count = calls.length;
    assert(
      (await handleRequest(new Request(url, { method: 'POST', body: 'action=unknown' }))).status ===
        400,
    );
    assert(
      (await handleRequest(new Request(`${url}x`, { method: 'POST', body: 'action=stop' })))
        .status === 400,
    );
    assert((await handleRequest(new Request(url, { method: 'PUT' }))).status === 405);
    assert(calls.length === count);
    fail = true;
    assert(
      (await handleRequest(new Request(url, { method: 'POST', body: 'action=stop' }))).status ===
        503,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
