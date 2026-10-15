import { jsonBody, limitedBody } from './body.ts';
function assert(value: unknown) {
  if (!value) throw new Error('Assertion failed');
}
Deno.test('body limits count streamed bytes, not just a claimed content length', async () => {
  const request = (parts: string[], length?: string) =>
    new Request('https://example.com', {
      method: 'POST',
      headers: length ? { 'Content-Length': length } : {},
      body: new ReadableStream({
        start(controller) {
          for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
          controller.close();
        },
      }),
    });
  assert(await limitedBody(request(['12', '34']), 4) === '1234');
  assert(await limitedBody(request(['12', '345']), 4) === null);
  assert(await limitedBody(request(['12', '345'], '1'), 4) === null);
  assert(await limitedBody(request(['é']), 1) === null);
  assert(await limitedBody(request(['é']), 2) === 'é');
  assert(jsonBody('{broken') === null);
  assert((jsonBody('{"ok":true}') as { ok: boolean }).ok);
});
