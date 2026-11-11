// In supabase/functions/_shared: deno test --allow-env (CI runs it).
import { detailRows, eventDatesRow } from './inquiry-email.ts';

function expectEqual(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
}

Deno.test('each asked-about event with a date in the plan gets its date', () => {
  expectEqual(
    eventDatesRow(
      ['jaago', 'reception'],
      ['Jaago', 'Reception'],
      { eventDates: { jaago: '2027-06-11', reception: '2027-06-13', mehndi: '2027-06-10' } },
      '2027-06-13',
    ),
    ['Event dates', 'Jaago: Fri, Jun 11, 2027; Reception: Sun, Jun 13, 2027'],
    'two events',
  );
});

Deno.test('one event on the date already shown adds nothing', () => {
  expectEqual(
    eventDatesRow(
      ['reception'],
      ['Reception'],
      { eventDates: { reception: '2027-06-13' } },
      '2027-06-13',
    ),
    null,
    'same date',
  );
  expectEqual(
    eventDatesRow(['reception'], ['Reception'], { eventDates: { reception: '2027-06-13' } }, null),
    ['Event date', 'Reception: Sun, Jun 13, 2027'],
    'date only in the plan',
  );
});

Deno.test('missing, odd or malformed dates are skipped', () => {
  expectEqual(eventDatesRow(['jaago'], ['Jaago'], {}, null), null, 'none');
  expectEqual(eventDatesRow(['jaago'], ['Jaago'], { eventDates: ['x'] }, null), null, 'array');
  expectEqual(
    eventDatesRow(['jaago'], ['Jaago'], { eventDates: { jaago: 'June 11' } }, null),
    null,
    'bad date',
  );
});

Deno.test("a hall's answers from Ask for a quote read as booking-sheet rows", () => {
  expectEqual(
    detailRows({
      timeOfDay: 'evening',
      catering: 'in_house',
      food: 'jhatka',
      liveStations: ['tandoor', 'chai'],
      alcohol: 'yes',
      ghoriDhol: true,
    }),
    [
      ['Time of day', 'Evening (dinner)'],
      ['Food', "The hall's kitchen"],
      ['Alcohol', 'Yes'],
      ['Baraat arriving with a horse and dhol', 'Yes'],
      ['Food', 'Jhatka'],
      ['Live counters', 'Tandoor, Chai'],
    ],
    'hall answers',
  );
  expectEqual(detailRows({ timeOfDay: 'midnight' }), [], 'an unknown time of day');
});
