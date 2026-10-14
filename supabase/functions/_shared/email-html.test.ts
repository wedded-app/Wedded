import { buildInquiryEmail } from './inquiry-email.ts';
Deno.test('inquiry emails escape user text and attribute delimiters', () => {
  const attack = '<img src=x onerror="alert(1)">';
  const email = buildInquiryEmail({
    inquiryId: attack,
    channel: 'email',
    vendorName: attack,
    vendorEmail: 'vendor@example.com',
    vendorPhone: null,
    eventNames: [attack],
    sender: { name: attack, email: 'family@example.com', phone: '+15305550100', city: attack },
    inquiry: {
      vendorId: 'vendor',
      eventSlugs: [],
      eventDate: null,
      startTime: null,
      guestBand: 'not_sure',
      location: attack,
      message: attack,
      preferredContact: 'email',
      language: 'en',
      details: {},
      name: null,
      phone: null,
      sendAgain: false,
    },
  });
  if (
    email.html.includes(attack) ||
    !email.html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  ) {
    throw new Error('User-controlled markup was not escaped');
  }
});
