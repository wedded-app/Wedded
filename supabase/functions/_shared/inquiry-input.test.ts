import { parseInquiry } from './inquiry-input.ts';
function assert(value: unknown) {
  if (!value) throw new Error('Assertion failed');
}
Deno.test('a tour takes up to three real days, each with a part of the day', () => {
  const tour = (tourSlots: unknown) =>
    parseInquiry({
      vendorId: '00000000-0000-4000-8000-000000000001',
      guestBand: 'not_sure',
      location: 'Yuba City',
      message: 'Can we visit?',
      preferredContact: 'call',
      details: { tour: true, tourSlots },
    }).ok;
  assert(tour([{ date: '2027-01-16', part: 'morning' }]));
  assert(!tour([{ date: '2027-02-30', part: 'morning' }]));
  assert(!tour([{ date: '2027-01-16', part: 'night' }]));
  assert(!tour([null]));
  assert(!tour(Array(4).fill({ date: '2027-01-16', part: 'evening' })));
});
