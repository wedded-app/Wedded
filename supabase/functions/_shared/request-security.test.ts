import { isServiceRequest, quietMinutes } from './request-security.ts';
function assert(value: unknown) {
  if (!value) throw new Error('Assertion failed');
}
Deno.test('service jobs reject forged role claims, empty config and malformed authorization', () => {
  const request = (authorization?: string) =>
    new Request('https://example.com', {
      headers: authorization ? { Authorization: authorization } : {},
    });
  const forged = `e30.${btoa(JSON.stringify({ role: 'service_role' }))}.forged`;
  assert(!isServiceRequest(request(`Bearer ${forged}`), 'real-service-key'));
  assert(!isServiceRequest(request(), ''));
  assert(!isServiceRequest(request(), 'real-service-key'));
  assert(!isServiceRequest(request('Basic real-service-key'), 'real-service-key'));
  assert(!isServiceRequest(request('Bearer real-service-key extra'), 'real-service-key'));
  assert(!isServiceRequest(request('Bearer real-service-kex'), 'real-service-key'));
  assert(isServiceRequest(request('Bearer real-service-key'), 'real-service-key'));
});
Deno.test('notification quiet window accepts only bounded integer minutes', () => {
  assert(quietMinutes({}) === 3);
  assert(quietMinutes({ quietMinutes: 1 }) === 1);
  assert(quietMinutes({ quietMinutes: 1440 }) === 1440);
  for (
    const value of [
      null,
      [],
      '3',
      { quietMinutes: -1 },
      { quietMinutes: 0 },
      { quietMinutes: 1.5 },
      { quietMinutes: 1441 },
      { quietMinutes: '3' },
    ]
  ) {
    assert(quietMinutes(value) === null);
  }
});
