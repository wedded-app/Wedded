import { matchFlow } from './flows';
import { activeTasks, doneEntries, getWed, waitingCount, wed } from './wed-store';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@/data/vendor-media', () => ({ photoUrl: (path: string) => `https://photos/${path}` }));

beforeEach(() => {
  jest.useFakeTimers();
  wed.reset();
  wed.setOnWedTab(true);
});

afterEach(() => {
  wed.reset();
  jest.useRealTimers();
});

describe('matchFlow', () => {
  it.each([
    ['Find a dhol player for the Jaago', 'dhol'],
    ['Ask Royal Orchard about parking and music', 'hall'],
    ["What's left to book for the Mehndi?", 'left'],
    ['What’s left to book for the Mehndi?', 'left'],
    ['Is Royal Orchard Banquet Hall free on Jun 13, and what do they charge?', 'hallFree'],
    ["Pay Royal Orchard's deposit", 'deposit'],
    ['Compare the 3 dhol players', 'compare'],
    ['Find a Mehndi artist free on Jun 10', 'mehndiArtist'],
    ['Find a ghori for the Baraat', 'ghori'],
    ['Find vendors like this for our Mehndi', 'reel'],
    ['What should we book next?', 'next'],
    ['Find the vendors we still need for the Jaago', 'dhol'],
    ['Find the vendors we still need for the Reception', 'rest'],
    ['Tell me if a hall opens on Jun 13', 'watch'],
    ['ਜਾਗੋ ਲਈ ਢੋਲੀ ਲੱਭੋ', 'dhol'],
    ['hello there', 'fallback'],
  ])('%s plays %s', (text, flow) => {
    expect(matchFlow(text).flow).toBe(flow);
  });

  it("answers what's left for another event with that event's own words", () => {
    const { flow, q } = matchFlow("What's left to book for the Roka?");
    expect(flow).toBe('eventLeft');
    expect(q).toMatch(/^The Roka is all booked/);
  });

  it('pulls the vendor out of a date question', () => {
    expect(matchFlow('Is Kesri Frames free on Jun 13, and what do they charge?')).toEqual({
      flow: 'free',
      q: 'Kesri Frames',
    });
  });

  it('pulls the search out of a web lookup', () => {
    expect(matchFlow('Look for sweets near Yuba City, including Instagram pages')).toEqual({
      flow: 'look',
      q: 'sweets',
    });
  });

  it('falls back on the context chip', () => {
    expect(
      matchFlow('How much?', { kind: 'vendor', label: 'Royal Orchard Banquet Hall' }).flow,
    ).toBe('hall');
    expect(matchFlow('Who made this?', { kind: 'reel', label: 'A reel' }).flow).toBe('reel');
  });
});

describe('the seed', () => {
  it('starts with yesterday, the tasting card waiting, and all caught up', () => {
    const s = getWed();
    expect(s.items).toHaveLength(6);
    expect(s.history).toBe(6);
    expect(waitingCount(s)).toBe(1);
    expect(s.status).toBe('All caught up');
    expect(s.mode).toBe('ask');
    expect(s.role).toBe('owner');
  });
});

describe('flow A', () => {
  it('works, then waits on a card; a yes holds 10 s, then the reply comes', () => {
    wed.send('Find a dhol player for the Jaago');
    expect(getWed().draft).toBe('');
    jest.advanceTimersByTime(1500);
    expect(getWed().status).toBe('Reading your plan');
    jest.advanceTimersByTime(3000);
    expect(getWed().status).toBe('Looking for Instagram pages');
    const running = activeTasks(getWed())[0];
    expect(running.now).toBe(2);
    expect(running.sources[0].kind).toBe('web');
    jest.advanceTimersByTime(8000);
    expect(getWed().status).toBe('All caught up');
    expect(waitingCount(getWed())).toBe(2);
    // ask mode: no "Saved 3" receipt
    expect(getWed().items.some((i) => i.kind === 'receipt')).toBe(false);

    wed.approve('ask-dhol');
    let card = getWed().approvals.find((a) => a.id === 'ask-dhol')!;
    expect(card.stage).toBe('held');
    expect(waitingCount(getWed())).toBe(1);

    wed.undo('ask-dhol');
    expect(getWed().approvals.find((a) => a.id === 'ask-dhol')!.stage).toBe('waiting');
    jest.advanceTimersByTime(20_000);
    expect(getWed().approvals.find((a) => a.id === 'ask-dhol')!.stage).toBe('waiting');

    wed.approve('ask-dhol');
    jest.advanceTimersByTime(10_000);
    card = getWed().approvals.find((a) => a.id === 'ask-dhol')!;
    expect(card.stage).toBe('done');
    expect(getWed().status).toBe('Waiting for 3 dhol players to reply');
    expect(doneEntries(getWed())[0].text).toBe('Asked 3 dhol players');

    // Off the tab when the reply lands
    wed.setOnWedTab(false);
    jest.advanceTimersByTime(12_000 + 1400);
    const kinds = getWed().items.map((i) => i.kind);
    expect(kinds.slice(-4)).toEqual(['divider', 'reply', 'wed', 'approval']);
    expect(getWed().approvals.some((a) => a.id === 'book-dhol' && a.stage === 'waiting')).toBe(
      true,
    );
    expect(getWed().status).toBe('Waiting for 2 dhol players to reply');
  });

  it('in small mode also saves them, with Undo', () => {
    wed.setMode('small');
    jest.advanceTimersByTime(500);
    wed.send('Find a dhol player for the Jaago');
    jest.advanceTimersByTime(11_000);
    const receipt = getWed().items.find((i) => i.kind === 'receipt');
    expect(receipt).toMatchObject({ text: 'Saved 3 to your Jaago list', undoFlow: 'unsave' });
    wed.undoReceipt(receipt!.key);
    jest.advanceTimersByTime(500);
    expect(getWed().items.at(-1)).toMatchObject({
      kind: 'wed',
      text: 'Okay, I took them off your Jaago list.',
    });
  });

  it('replaying gives fresh ids', () => {
    wed.send('Find a dhol player for the Jaago');
    jest.advanceTimersByTime(12_500);
    wed.send('Find a dhol player for the Jaago');
    jest.advanceTimersByTime(12_500);
    const ids = getWed().approvals.map((a) => a.id);
    expect(ids).toEqual(['tasting', 'ask-dhol', 'ask-dhol-2']);
    expect(getWed().tasks.map((t) => t.id)).toContain('dhol-2');
  });
});

describe('cards', () => {
  it('only the owner can say yes; viewers remind and suggesters suggest', () => {
    wed.setRole('viewer');
    wed.approve('tasting');
    expect(getWed().approvals[0].stage).toBe('waiting');
    wed.remind('tasting');
    expect(getWed().items.at(-1)).toMatchObject({ kind: 'receipt', text: 'Reminded Simran' });
    wed.setRole('suggester');
    wed.suggest('tasting');
    expect(getWed().approvals[0].suggested).toBe(true);
  });

  it('Not now declines, and the deposit preview moves nothing', () => {
    wed.decline('tasting');
    expect(getWed().approvals[0].stage).toBe('declined');
    wed.send("Pay Royal Orchard's deposit");
    jest.advanceTimersByTime(1500);
    const deposit = getWed().approvals.find((a) => a.id === 'deposit')!;
    expect(deposit.preview).toBe(true);
    wed.approve('deposit');
    expect(getWed().approvals.find((a) => a.id === 'deposit')!.stage).toBe('done');
    wed.undo('deposit');
    expect(getWed().approvals.find((a) => a.id === 'deposit')!.stage).toBe('done');
    // The other way it can be paid is undoable
    wed.send("Pay Royal Orchard's deposit");
    jest.advanceTimersByTime(1500);
    wed.alt('deposit-2');
    expect(getWed().approvals.find((a) => a.id === 'deposit-2')).toMatchObject({
      stage: 'done',
      chose: 'alt',
    });
    wed.undo('deposit-2');
    expect(getWed().approvals.find((a) => a.id === 'deposit-2')!.stage).toBe('waiting');
  });
});

describe('apps and memory', () => {
  it('connects Gmail as a preview and makes the emails list', () => {
    wed.connect('gmail', 'vendors');
    expect(getWed().apps.gmail).toMatchObject({ status: 'preview', level: 'vendors' });
    jest.advanceTimersByTime(500);
    expect(getWed().items.at(-1)).toMatchObject({ kind: 'artifact', id: 'emails' });
    wed.disconnect('gmail');
    expect(getWed().apps.gmail.status).toBe('soon');
    wed.notifyMe('pay');
    expect(getWed().apps.pay.notify).toBe(true);
    wed.notifyMe('pay');
    expect(getWed().apps.pay.notify).toBe(false);
  });

  it('forgets and shares facts', () => {
    const first = getWed().facts[0];
    wed.toggleShared(first.id);
    expect(getWed().facts[0].shared).toBe(!first.shared);
    wed.forget(first.id);
    expect(getWed().facts.some((f) => f.id === first.id)).toBe(false);
    wed.reset();
    expect(getWed().facts[0].id).toBe(first.id);
  });
});

describe('apps and memory', () => {
  it('disconnecting Gmail strikes out its emails and says so', () => {
    wed.connect('gmail', 'vendors');
    jest.advanceTimersByTime(500);
    expect(getWed().items.some((i) => i.kind === 'artifact' && i.id === 'emails')).toBe(true);
    wed.disconnect('gmail');
    const emails = getWed().items.find((i) => i.kind === 'artifact' && i.id === 'emails');
    expect(emails).toMatchObject({ gone: true });
    expect(getWed().items.at(-1)).toMatchObject({
      kind: 'receipt',
      text: 'Disconnected Gmail. I forgot those emails.',
    });
  });

  it('a forgotten fact comes back where it was', () => {
    const [, second] = getWed().facts;
    wed.forget(second.id);
    expect(getWed().facts.some((f) => f.id === second.id)).toBe(false);
    wed.restoreFact(second, 1);
    expect(getWed().facts[1].id).toBe(second.id);
  });
});
