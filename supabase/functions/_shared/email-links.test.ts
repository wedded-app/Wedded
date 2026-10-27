import type { SupabaseClient } from '@supabase/supabase-js';
import { inquiryEmailsFor, signedParams, verifiedEmail, withFooter } from './email-links.ts';
import type { InquiryEmailInput, OutgoingEmail } from './inquiry-email.ts';

function assert(value: unknown, message = 'Assertion failed'): asserts value {
  if (!value) throw new Error(message);
}

Deno.test('signed links normalize addresses and reject changes and malformed input', async () => {
  const params = new URLSearchParams(await signedParams('Name <FAMILY@example.com>', 'test-key'));
  assert(
    await verifiedEmail(params.get('e'), params.get('t'), 'test-key') === 'family@example.com',
  );
  const other = new URLSearchParams(await signedParams('other@example.com', 'test-key'));
  assert(await verifiedEmail(other.get('e'), params.get('t'), 'test-key') === null);
  assert(await verifiedEmail(params.get('e'), `x${params.get('t')}`, 'test-key') === null);
  assert(await verifiedEmail(params.get('e'), params.get('t'), 'different-key') === null);
  assert(await verifiedEmail('!!', 'bad', 'test-key') === null);
  assert(await verifiedEmail(null, null, 'test-key') === null);
});

const email: OutgoingEmail = {
  from: 'Wedded <hello@example.com>',
  to: ['vendor@example.com'],
  cc: [],
  bcc: [],
  replyTo: [],
  subject: 'An inquiry',
  text: 'Hello',
  html: '<body>Hello</body>',
};

Deno.test('footer explains why, escapes HTML and provides headers only for an unshared email', async () => {
  Deno.env.set('EMAIL_LINK_SECRET', 'test-key');
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
  const result = await withFooter(email, 'vendor@example.com', 'A family asked <you>');
  assert(result.text.includes('A family asked <you>'));
  assert(result.text.includes('Stop these emails to vendor@example.com'));
  assert(result.html.includes('A family asked &lt;you&gt;'));
  assert(result.html.indexOf('Stop these emails') < result.html.indexOf('</body>'));
  assert(result.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');
  for (
    const shared of [{ ...email, cc: ['family@example.com'] }, {
      ...email,
      bcc: ['founders@example.com'],
    }, {
      ...email,
      to: ['a@b.com', 'c@d.com'],
    }]
  ) {
    assert(
      !(await withFooter(shared, 'vendor@example.com', 'Inquiry')).headers?.['List-Unsubscribe'],
    );
  }
});

function admin(stopped: string[], fail = false): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        in: () =>
          Promise.resolve({
            data: stopped.map((email) => ({ email })),
            error: fail ? new Error('DB unavailable') : null,
          }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const input: InquiryEmailInput = {
  inquiryId: 'test-inquiry',
  channel: 'email',
  vendorName: 'Vendor',
  vendorEmail: 'vendor@example.com',
  vendorPhone: null,
  eventNames: [],
  sender: {
    name: 'Family Person',
    phone: '+15305550100',
    email: 'family@example.com',
    city: 'Yuba City',
  },
  inquiry: {
    vendorId: 'vendor',
    eventSlugs: [],
    eventDate: null,
    startTime: null,
    guestBand: 'not_sure',
    location: 'Yuba City',
    message: 'Hello',
    preferredContact: 'email',
    details: {},
    name: null,
    phone: null,
    sendAgain: false,
  },
};

Deno.test('inquiries relay opted-out vendors and omit opted-out family copies', async () => {
  Deno.env.set('EMAIL_LINK_SECRET', 'test-key');
  Deno.env.set('FOUNDERS_EMAIL', 'founders@example.com');
  Deno.env.delete('INQUIRY_TEST_INBOX');
  const [vendor, copy, extra] = await inquiryEmailsFor(admin([]), input);
  assert(vendor.to.join() === 'vendor@example.com' && vendor.cc.length === 0);
  assert(copy.to.join() === 'family@example.com' && copy.bcc.length === 0 && !extra);
  // Each stop link stops only its own reader's emails
  assert(vendor.text.includes('Stop these emails to vendor@example.com'));
  assert(copy.text.includes('Stop these emails to family@example.com'));
  assert(!copy.text.includes('vendor@example.com'), 'the copy names no vendor address');
  assert(copy.headers?.['List-Unsubscribe'], 'the family can stop its copies in one click');
  assert(!vendor.headers?.['List-Unsubscribe'], 'not while founders get a blind copy');
  const relayed = await inquiryEmailsFor(
    admin(['vendor@example.com', 'family@example.com']),
    input,
  );
  assert(relayed.length === 1 && relayed[0].to.join() === 'founders@example.com');
  const noCopy = await inquiryEmailsFor(admin(['family@example.com']), input);
  assert(noCopy.length === 1 && noCopy[0].to.join() === 'vendor@example.com');
  const relayedWithCopy = await inquiryEmailsFor(admin(['vendor@example.com']), input);
  assert(
    relayedWithCopy.map((e) => e.to.join()).join() === 'founders@example.com,family@example.com',
  );
  let failed = false;
  try {
    await inquiryEmailsFor(admin([], true), input);
  } catch {
    failed = true;
  }
  assert(failed, 'Database failures must not bypass opt-out checks');
});

Deno.test('the test inbox gets inquiries alone, sent from the Resend test address by default', async () => {
  Deno.env.set('EMAIL_LINK_SECRET', 'test-key');
  Deno.env.set('FOUNDERS_EMAIL', 'founders@example.com');
  Deno.env.set('INQUIRY_TEST_INBOX', 'inbox@example.com');
  Deno.env.delete('INQUIRY_FROM');
  try {
    for (const stopped of [[], ['vendor@example.com']]) {
      const emails = await inquiryEmailsFor(admin(stopped), input);
      assert(emails.length === 1, 'no family copy in test mode');
      const sent = emails[0];
      assert(sent.to.join() === 'inbox@example.com', `to: ${sent.to}`);
      assert(sent.cc.length === 0 && sent.bcc.length === 0, `copies: ${sent.cc} ${sent.bcc}`);
      assert(sent.from === 'Wedded App <onboarding@resend.dev>', `from: ${sent.from}`);
    }
  } finally {
    Deno.env.delete('INQUIRY_TEST_INBOX');
  }
});
