// deno test supabase/functions/push-chat (not run in CI; CI type-checks,
// lints and format-checks the function).
import { buildPushes, pushBody, type PushClaim } from './push.ts';

function expectEqual(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
}

const claim: PushClaim = {
  message_id: 'm1',
  conversation_id: 'c1',
  recipient_side: 'vendor',
  tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
  title: 'Harjit K.',
  kind: 'text',
  body: 'Is June 12   open\nfor 300?',
  data: {},
  event_names: [],
};

Deno.test('a text shows the message, on one line', () => {
  expectEqual(pushBody(claim), 'Is June 12 open for 300?', 'text');
  expectEqual(pushBody({ ...claim, body: 'x'.repeat(200) }).length, 140, 'long text is cut');
});

Deno.test('other kinds say what was sent, never a phone number', () => {
  expectEqual(pushBody({ ...claim, kind: 'photo', body: null }), '📷 Photo', 'photo');
  expectEqual(
    pushBody({ ...claim, kind: 'photo', body: 'The stage' }),
    '📷 Photo: The stage',
    'caption',
  );
  expectEqual(pushBody({ ...claim, kind: 'voice', body: null }), '🎤 Voice note', 'voice');
  expectEqual(
    pushBody({ ...claim, kind: 'deposit', body: null, data: { depositId: 'd1' } }),
    '💳 Asked for a deposit',
    'deposit request',
  );
  expectEqual(
    pushBody({ ...claim, kind: 'deposit', body: null, data: { depositId: 'd1', update: 'paid' } }),
    '✅ Deposit paid',
    'deposit paid',
  );
  expectEqual(
    pushBody({
      ...claim,
      kind: 'proposal',
      data: { proposalId: 'p', requestId: 'r', update: 'accepted' },
    }),
    '🤝 Accepted your proposal',
    'proposal accepted',
  );
  expectEqual(
    pushBody({ ...claim, kind: 'phone', body: null, data: { phone: '+15305550101' } }),
    'Shared their phone number',
    'phone',
  );
});

Deno.test('a new request names the events and the date', () => {
  expectEqual(
    pushBody({
      ...claim,
      kind: 'booking',
      body: null,
      data: { eventDate: '2027-06-12', details: {} },
      event_names: ['Jaago', 'Reception'],
    }),
    'New request: Jaago, Reception · Sat, Jun 12, 2027',
    'request',
  );
  expectEqual(
    pushBody({ ...claim, kind: 'booking', body: null, data: { details: { tour: true } } }),
    'Tour request: Wedding',
    'tour without a date',
  );
});

Deno.test('one alert per phone, opening the chat', () => {
  const pushes = buildPushes(claim);
  expectEqual(pushes.map((p) => p.to), claim.tokens, 'tokens');
  expectEqual(pushes[0].data, { conversationId: 'c1', url: '/chat/c1' }, 'data');
  expectEqual(pushes[0].title, 'Harjit K.', 'title');
});
