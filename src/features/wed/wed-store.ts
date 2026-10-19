import { router } from 'expo-router';
import { useRef, useSyncExternalStore } from 'react';

import type { IconName } from '@/components/icon';
import { sendToVendor } from '@/data/chat';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

import {
  eventNames,
  eventsIn,
  FLOWS,
  guestApproval,
  guestTarget,
  matchFlow,
  type FlowKey,
  type Op,
} from './flows';
import {
  APPS,
  CATERER,
  EVENTS,
  FACTS,
  FAMILY,
  type AppId,
  type Fact,
  type FoundPage,
  type MockVendor,
} from './mock';
import type { GuestChannel, GuestSend } from './send-to-guests';
import type { Step } from './step-list';

/**
 * MOCKUP: Wed's state, in memory, for every Wed screen at once. A tiny
 * external store (useSyncExternalStore), so approving a card on Home also
 * resolves it in the thread and on Updates. The timers live here too, so a
 * scripted flow keeps playing while the family is on another tab, and a
 * vendor's reply that lands meanwhile gets a "While you were away" line.
 * Nothing is saved: a reload (or Replay the demo) starts over.
 */

export type Role = 'owner' | 'suggester' | 'viewer';
export type Mode = 'ask' | 'small';
export type CheckIns = 'needed' | 'daily' | 'often';

/** What the family is asking about: the chip above the composer. */
export type WedContext = {
  kind: 'vendor' | 'event' | 'reel' | 'query' | 'plan';
  id?: string;
  /** "Royal Orchard Banquet Hall", shown as "About: Royal Orchard Banquet Hall". */
  label: string;
  /** A small picture in the chip, e.g. a reel's still. */
  thumb?: string;
};

export type SourceKind = 'plan' | 'wedded' | 'web' | 'maps' | 'calendar' | 'chat';

/** Something Wed is looking at while it works: "Looking at instagram.com/gabru.dhol". */
export type Source = {
  kind: SourceKind;
  /** Where it is: "Wedded", "Pages on the web", "Your plan". */
  label: string;
  /** What it is, the line a source card shows: "instagram.com/gabru.dhol". */
  detail: string;
  /** A vendor's photo, for `wedded` sources. */
  photo?: string;
};

/** The glyph for a source without a photo, drawn in a `fill` circle. */
export const SOURCE_ICONS: Record<SourceKind, IconName> = {
  plan: 'list-outline',
  wedded: 'storefront-outline',
  web: 'globe-outline',
  maps: 'map-outline',
  calendar: 'calendar-outline',
  chat: 'chatbubbles-outline',
};

/** One step of a task as a flow writes it. */
export type TaskStep = {
  /** "Finding dhol players' Instagram pages near Yuba City", the working line. */
  label: string;
  /** The status line while this step runs: "Looking for Instagram pages". */
  short: string;
  /** What this step looks at, one after another in the source card. */
  sources: Source[];
  /** What it found, under the step once it's done: "Wedded: 3 near Yuba City". */
  result?: string;
};

export type TaskSpec = {
  id: string;
  /** "Finding dhol players", for the progress chip and Updates. */
  title: string;
  steps: TaskStep[];
};

export type Task = {
  id: string;
  title: string;
  /** The current step's short line, or what a waiting task waits for. */
  short: string;
  /** Ready for <StepList />: each step's state, and its result (or what it's
   * looking at, for the current one) as the `source` line under it. */
  steps: Step[];
  /** What the current step is looking at; the source card cycles them. */
  sources: Source[];
  /** The current step, from 0: "3 of 4" is `now + 1` of `steps.length`. */
  now: number;
  state: 'running' | 'waiting' | 'done';
  /** Once done: "Worked 1 min · checked 14 pages". */
  summary?: string;
  /** The steps as the flow wrote them. */
  plan: TaskStep[];
  startedAt: number;
};

export type ApprovalKind = 'ask' | 'message' | 'tour' | 'markBooked' | 'pay' | 'invite';

/** A card as a flow writes it: everything the family sees before saying yes. */
export type ApprovalSpec = {
  id: string;
  kind: ApprovalKind;
  /** One plain sentence: "Ask 3 dhol players if they're free on Friday, June 12". */
  title: string;
  /** The primary button, naming the action: "Ask all 3", "Book tour". */
  verb: string;
  /** `slug`: the vendor on Wedded the message really goes to; without one nothing is sent. */
  to: { name: string; photo?: string; blurhash?: string; slug?: string }[];
  /** "Jaago · Fri, Jun 12, 2027" */
  forLine: string;
  /** The exact message, shown in full; the family can change it. */
  message?: string;
  /** What reaches the vendor besides the message, always true to the channel. */
  shares: string;
  /** The same in a few words, for the compact card: "Shares your first name and phone". */
  sharesShort: string;
  cost: string;
  /** How it can be undone, in words: "You can undo for 10 seconds". */
  undo: string;
  /** A later feature shown as a preview: a "Coming later" pill, and approving moves nothing. */
  preview?: boolean;
  /** A second, softer choice: "I paid another way". */
  altLabel?: string;
  /** The receipt when the family picks `altLabel`. */
  altReceipt?: string;
  /** Replaces the card's usual footer. */
  footer?: string;
  /** The one line while Undo still works: "Sent to 3 dhol players". */
  heldText: string;
  /** The line once it's done for good: "Asked 3 dhol players" (the time is added). */
  receipt: string;
  /** The status line between done and the reply: "Waiting for 3 dhol players to reply". */
  waiting?: string;
  /** A flow that plays `after` ms once it's done, e.g. the vendor's reply. */
  then?: { flow: FlowKey; after: number };
  /** An `invite` card: the guest list, the cards and how they go (the family can change it). */
  guests?: GuestSend;
};

export type ApprovalStage = 'waiting' | 'held' | 'done' | 'declined';

export type Approval = ApprovalSpec & {
  stage: ApprovalStage;
  /** While held: when Undo stops working (ms since epoch). */
  heldUntil?: number;
  /** When it was done or declined. */
  doneAt?: number;
  /** Which button finished it. */
  chose?: 'verb' | 'alt';
  /** A suggester sent it to the owner's Suggestions. */
  suggested?: boolean;
  /** A viewer reminded the owner. */
  reminded?: boolean;
  /** The chats the message went to, once it's really sent. */
  chats?: string[];
  createdAt: number;
};

/** One row of the thread. `key` is the row's own id; `at` when it arrived. */
export type ChatItem = (
  | { kind: 'me'; text: string; spoken?: boolean; photo?: string; about?: string }
  | { kind: 'wed'; text: string }
  /** "Yesterday", "While you were away" */
  | { kind: 'divider'; text: string }
  | { kind: 'work'; taskId: string }
  | { kind: 'vendors'; vendors: MockVendor[]; found?: FoundPage[]; checked: string }
  | { kind: 'approval'; id: string }
  | { kind: 'receipt'; text: string; undoFlow?: FlowKey; undone?: boolean }
  | { kind: 'reply'; vendor: MockVendor; who: string; text: string }
  /** Invitation cards Wed made, one per event (EVENTS slugs). */
  | { kind: 'cards'; events: string[] }
  /** A list Wed made, by LIBRARY id (libraryList() in mock.ts); `gone` once its app is disconnected. */
  | { kind: 'artifact'; id: string; gone?: boolean }
  /** The STARTERS rows, after the fallback answer. */
  | { kind: 'starters' }
) & { key: string; at: number };

export type ChatKind = ChatItem['kind'];

export type AppState = {
  status: 'builtIn' | 'off' | 'connected' | 'preview' | 'soon';
  /** How much it can see, e.g. 'vendors' (only emails from your vendors) or 'all'. */
  level?: string;
  /** "Tell me when it's ready" was tapped. */
  notify?: boolean;
  /** When it was connected. */
  since?: number;
};

export type WedState = {
  items: ChatItem[];
  /** How many of `items` are from before today; the greeting goes after them. */
  history: number;
  approvals: Approval[];
  tasks: Task[];
  mode: Mode;
  checkIns: CheckIns;
  role: Role;
  apps: Record<AppId, AppState>;
  facts: Fact[];
  /** What's in the composer. */
  draft: string;
  context: WedContext | null;
  /** The chat is on screen (set by the Wed tab's focus). */
  onWedTab: boolean;
  /** The header line: the running step, what Wed waits for, or "All caught up". */
  status: string;
  /** An approval to scroll to (Look first on Home); the chat clears it once shown. */
  focus: string | null;
  /** Vendors saved to Wed's Jaago list from a card in the thread, by slug. */
  saved: string[];
};

const HOLD_MS = 10_000;
const CAUGHT_UP = 'All caught up';
/** The line before a vendor's reply that came while the family was elsewhere. */
export const AWAY_LINE = 'While you were away';

// ---------------------------------------------------------------------------
// The store

let state: WedState = seed();
const listeners = new Set<() => void>();
// Every pending flow op and hold, so reset() can stop them all
const timers = new Set<ReturnType<typeof setTimeout>>();
const holds = new Map<string, ReturnType<typeof setTimeout>>();
// A "While you were away" line goes in once per time away
let awayLineShown = false;
let nextKey = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(patch: Partial<WedState>) {
  const next = { ...state, ...patch };
  if (patch.tasks) next.status = statusOf(next.tasks);
  state = next;
  listeners.forEach((listener) => listener());
}

function later(ms: number, run: () => void) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    run();
  }, ms);
  timers.add(timer);
  return timer;
}

const key = () => `w${nextKey++}`;

function push(...rows: DistributiveOmit<ChatItem, 'key' | 'at'>[]) {
  const at = Date.now();
  set({ items: [...state.items, ...rows.map((row) => ({ ...row, key: key(), at }) as ChatItem)] });
}

function patchApproval(id: string, patch: Partial<Approval>) {
  set({ approvals: state.approvals.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
}

function patchTask(id: string, patch: (task: Task) => Partial<Task>) {
  set({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch(t) } : t)) });
}

// Pages that keep a little demo state of their own (Goals' watches) start
// over with Replay the demo too
const resetListeners = new Set<() => void>();

/** Runs `listener` on every Replay the demo; returns the unsubscribe. */
export function onWedReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

/** The current state, outside React (e.g. in an event handler). */
export function getWed(): WedState {
  return state;
}

/**
 * Reads part of Wed's state and re-renders only when that part changes
 * (compared shallowly, so `s => s.approvals.filter(...)` is fine).
 *   const waiting = useWed((s) => s.approvals.filter((a) => a.stage === 'waiting').length);
 */
export function useWed<T>(select: (s: WedState) => T): T {
  const cache = useRef<{ state: WedState; select: (s: WedState) => T; value: T } | null>(null);
  const getSnapshot = () => {
    const last = cache.current;
    if (last && last.state === state && last.select === select) return last.value;
    const next = select(state);
    const value = last && shallowEqual(last.value, next) ? last.value : next;
    cache.current = { state, select, value };
    return value;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---------------------------------------------------------------------------
// Flows

type Run = { flow: FlowKey; q?: string; ids: Map<string, string> };

function play(flow: FlowKey, q?: string) {
  const run: Run = { flow, q: q ?? FLOWS[flow].fill, ids: new Map() };
  for (const { at, do: op } of FLOWS[flow].ops) later(at, () => apply(op, run));
}

// "{q}" in a flow's words becomes what the family asked about
function fill(text: string, run: Run) {
  return run.q === undefined ? text : text.split('{q}').join(run.q);
}

function fillStep(step: TaskStep, run: Run): TaskStep {
  return {
    ...step,
    label: fill(step.label, run),
    short: fill(step.short, run),
    result: step.result === undefined ? undefined : fill(step.result, run),
    sources: step.sources.map((source) => ({ ...source, detail: fill(source.detail, run) })),
  };
}

// A replayed flow gets fresh ids, so its cards don't collide with the first run's
function unique(base: string, taken: { id: string }[]) {
  let id = base;
  for (let n = 2; taken.some((x) => x.id === id); n++) id = `${base}-${n}`;
  return id;
}

function apply(op: Op, run: Run) {
  switch (op.op) {
    case 'say':
      push({ kind: 'wed', text: fill(op.text, run) });
      return;
    case 'task': {
      const id = unique(op.task.id, state.tasks);
      run.ids.set(op.task.id, id);
      const plan = op.task.steps.map((step) => fillStep(step, run));
      const task: Task = {
        id,
        title: fill(op.task.title, run),
        plan,
        now: 0,
        state: 'running',
        short: plan[0]?.short ?? '',
        sources: plan[0]?.sources ?? [],
        steps: stepsFor(plan, 0, 'running'),
        startedAt: Date.now(),
      };
      set({ tasks: [...state.tasks, task] });
      push({ kind: 'work', taskId: id });
      return;
    }
    case 'step':
      patchTask(run.ids.get(op.taskId) ?? op.taskId, (task) => {
        const now = Math.min(task.now + 1, task.plan.length - 1);
        return {
          now,
          short: task.plan[now].short,
          sources: task.plan[now].sources,
          steps: stepsFor(task.plan, now, 'running'),
        };
      });
      return;
    case 'finish':
      patchTask(run.ids.get(op.taskId) ?? op.taskId, (task) => ({
        state: 'done',
        summary: op.summary,
        now: task.plan.length - 1,
        sources: [],
        steps: stepsFor(task.plan, task.plan.length, 'done'),
      }));
      // A task finishing while you watch
      if (state.onWedTab) selectionHaptic();
      return;
    case 'vendors':
      push({
        kind: 'vendors',
        vendors: op.vendors,
        found: op.found,
        checked: `Checked today · ${clockTime(Date.now())}`,
      });
      return;
    case 'approval': {
      const id = unique(op.a.id, state.approvals);
      run.ids.set(op.a.id, id);
      const approval: Approval = {
        ...op.a,
        id,
        message: op.a.message === undefined ? undefined : fill(op.a.message, run),
        stage: 'waiting',
        createdAt: Date.now(),
      };
      set({ approvals: [...state.approvals, approval] });
      push({ kind: 'approval', id });
      return;
    }
    case 'reply':
      if (!state.onWedTab && !awayLineShown) {
        awayLineShown = true;
        push({ kind: 'divider', text: AWAY_LINE });
      }
      push({ kind: 'reply', vendor: op.vendor, who: op.who, text: op.text });
      return;
    case 'receipt':
      push({ kind: 'receipt', text: fill(op.text, run), undoFlow: op.undoFlow });
      return;
    case 'artifact':
      push({ kind: 'artifact', id: op.id });
      return;
    case 'cards': {
      const events = eventsIn(run.q ?? '');
      push({
        kind: 'wed',
        text: `Here are your cards for ${eventNames(events)}, filled in from your plan.`,
      });
      later(400, () => push({ kind: 'cards', events }));
      return;
    }
    case 'guests': {
      // "Send them": the cards Wed made last, else every event's
      const made = [...state.items].reverse().find((item) => item.kind === 'cards');
      const events = made?.kind === 'cards' ? made.events : EVENTS.map((e) => e.slug);
      const to = guestTarget(run.q ?? '');
      apply({ op: 'approval', a: guestApproval({ to, events, channel: 'each' }) }, run);
      return;
    }
    case 'vault': {
      const to = guestTarget(run.q ?? '');
      apply(
        { op: 'approval', a: guestApproval({ to, events: [], vault: true, channel: 'each' }) },
        run,
      );
      return;
    }
    case 'starters':
      push({ kind: 'starters' });
      return;
    case 'onlyIfSmall':
      if (state.mode === 'small') apply(op.then, run);
      return;
    case 'wait':
      startWaiting(op.id, op.title, op.short);
      return;
    case 'endWait':
      endWaiting(op.id);
      return;
  }
}

function stepsFor(plan: TaskStep[], now: number, taskState: Task['state']): Step[] {
  return plan.map((step, index) => {
    if (taskState === 'done' || index < now) {
      return { label: step.label, state: 'done', source: step.result };
    }
    if (index > now) return { label: step.label, state: 'next' };
    const looking = step.sources.map((source) => source.detail);
    return {
      label: step.label,
      state: 'now',
      source:
        looking.length === 0
          ? undefined
          : `Looking at ${looking.slice(0, 3).join(', ')}${looking.length > 3 ? ` and ${looking.length - 3} more` : ''}`,
    };
  });
}

function startWaiting(id: string, title: string, short: string) {
  const waiting: Task = {
    id,
    title,
    short,
    steps: [],
    sources: [],
    now: 0,
    state: 'waiting',
    plan: [],
    startedAt: Date.now(),
  };
  set({ tasks: [...state.tasks.filter((t) => t.id !== id), waiting] });
}

function endWaiting(id: string) {
  if (!state.tasks.some((t) => t.id === id && t.state === 'waiting')) return;
  patchTask(id, () => ({ state: 'done' }));
}

function statusOf(tasks: Task[]): string {
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].state === 'running') return tasks[i].short;
  }
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].state === 'waiting') return tasks[i].short;
  }
  return CAUGHT_UP;
}

// Ten seconds after a yes it's done for good, and what follows is scheduled
function settle(id: string) {
  holds.delete(id);
  const approval = state.approvals.find((a) => a.id === id);
  if (!approval || approval.stage !== 'held') return;
  patchApproval(id, { stage: 'done', doneAt: Date.now(), heldUntil: undefined });
  deliver(approval);
  const waitId = `wait-${id}`;
  if (approval.waiting) startWaiting(waitId, approval.receipt, approval.waiting);
  const then = approval.then;
  if (then) {
    later(then.after, () => {
      endWaiting(waitId);
      play(then.flow);
    });
  }
}

/** The cards whose yes sends the family's message to a vendor. */
export const SENDS: ApprovalKind[] = ['ask', 'message', 'tour'];

// A final yes really sends: each vendor's chat with the family gets the
// message, so it's in Messages like anything they typed, to carry on there.
function deliver(approval: Approval) {
  // Guests: the sending sheet opens Messages (or Mail) on the family's phone
  if (approval.kind === 'invite') {
    router.push({ pathname: '/wed-send', params: { id: approval.id } });
    return;
  }
  // The mockup's family signs as Simran; the chat already shows who really sent it
  const signed = ` –\u2060\u00A0${FAMILY.signature}`;
  const text = approval.message?.endsWith(signed)
    ? approval.message.slice(0, -signed.length)
    : approval.message;
  if (!text || approval.preview || !SENDS.includes(approval.kind)) return;
  for (const vendor of approval.to) {
    if (!vendor.slug) continue;
    sendToVendor(vendor.slug, text).then(
      (chat) => {
        const chats = state.approvals.find((a) => a.id === approval.id)?.chats ?? [];
        patchApproval(approval.id, { chats: [...chats, chat] });
      },
      () =>
        push({
          kind: 'receipt',
          text: `Couldn't send to ${vendor.name}. Check your connection, then message them from their page.`,
        }),
    );
  }
}

// ---------------------------------------------------------------------------
// Actions

/** Everything the Wed screens can do. Each one updates every screen at once. */
export const wed = {
  /**
   * Sends what the family typed (or said, or a photo) and plays the flow its
   * words match, or the fallback. Clears the composer and the context chip.
   */
  send(text: string, options: { spoken?: boolean; photo?: string } = {}) {
    const words = text.trim();
    if (!words && !options.photo) return;
    const context = state.context;
    push({
      kind: 'me',
      text: words,
      spoken: options.spoken,
      photo: options.photo,
      about: context?.label,
    });
    set({ draft: '', context: null });
    if (options.photo) return play('photo');
    const { flow, q } = matchFlow(words, context);
    play(flow, q);
  },
  /** Plays a flow by name (Ideas, the voice screen, Replay). */
  start(flow: FlowKey, q?: string) {
    play(flow, q);
  },
  /**
   * The family says yes. Held for 10 seconds with Undo, then done: the
   * receipt shows and anything that follows (a vendor's reply) is scheduled.
   * A preview is done at once and moves nothing. Owners only.
   */
  approve(id: string) {
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval || approval.stage !== 'waiting' || state.role !== 'owner') return;
    successHaptic();
    if (approval.preview) {
      patchApproval(id, { stage: 'done', chose: 'verb', doneAt: Date.now() });
      return;
    }
    patchApproval(id, { stage: 'held', chose: 'verb', heldUntil: Date.now() + HOLD_MS });
    holds.set(
      id,
      later(HOLD_MS, () => settle(id)),
    );
  },
  /** Back to waiting: a yes still within its 10 seconds, a Not now, or "I paid another way". */
  undo(id: string) {
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval) return;
    const undoable =
      approval.stage === 'held' ||
      approval.stage === 'declined' ||
      (approval.stage === 'done' && approval.chose === 'alt');
    if (!undoable) return;
    const hold = holds.get(id);
    if (hold) {
      clearTimeout(hold);
      timers.delete(hold);
      holds.delete(id);
    }
    selectionHaptic();
    patchApproval(id, {
      stage: 'waiting',
      heldUntil: undefined,
      doneAt: undefined,
      chose: undefined,
    });
  },
  /** Not now: nothing is sent ("Not sent. Ask me again any time."). */
  decline(id: string) {
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval || approval.stage !== 'waiting') return;
    patchApproval(id, { stage: 'declined', doneAt: Date.now() });
  },
  /** The second choice (`altLabel`): done at once with `altReceipt`, and Undo stays. */
  alt(id: string) {
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval || approval.stage !== 'waiting' || state.role !== 'owner') return;
    selectionHaptic();
    patchApproval(id, { stage: 'done', chose: 'alt', doneAt: Date.now() });
  },
  /** A viewer's "Remind Simran": always a tap, and it leaves a receipt. */
  remind(id: string) {
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval || approval.reminded) return;
    selectionHaptic();
    patchApproval(id, { reminded: true });
    push({ kind: 'receipt', text: `Reminded ${FAMILY.owner}` });
  },
  /** A suggester's "Suggest to Simran" (suggest_vendor() in the real app). */
  suggest(id: string) {
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval || approval.suggested) return;
    successHaptic();
    patchApproval(id, { suggested: true });
    push({
      kind: 'receipt',
      text: `Suggested to ${FAMILY.owner}. She'll see it in Suggestions.`,
    });
  },
  /** The family changed the message on a card. */
  editMessage(id: string, text: string) {
    patchApproval(id, { message: text });
  },
  /**
   * What Wed's brain (#124) calls to send something to a guest list: a
   * confirm card in the thread, and nothing goes until the family taps
   * Send. After the 10 seconds for Undo, /wed-send opens Messages or Mail.
   */
  sendToGuests(send: GuestSend) {
    apply({ op: 'approval', a: guestApproval(send) }, { flow: 'guests', ids: new Map() });
  },
  /** Text each person, one group text or email, on an `invite` card. */
  setChannel(id: string, channel: GuestChannel) {
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval?.guests || approval.stage !== 'waiting') return;
    patchApproval(id, { guests: { ...approval.guests, channel } });
  },
  /** A line in the thread for something done outside it ("Texted 38 of 40 on your Mehndi list"). */
  note(text: string) {
    push({ kind: 'receipt', text });
  },
  /** Undo on a receipt row ("Saved 3 to your Jaago list"): marks it undone and plays its undoFlow. */
  undoReceipt(itemKey: string) {
    const item = state.items.find((i) => i.key === itemKey);
    if (!item || item.kind !== 'receipt' || item.undone) return;
    selectionHaptic();
    set({ items: state.items.map((i) => (i.key === itemKey ? { ...i, undone: true } : i)) });
    if (item.undoFlow) play(item.undoFlow);
  },
  setDraft(text: string) {
    set({ draft: text });
  },
  /** The chip above the composer; null clears it. */
  setContext(context: WedContext | null) {
    set({ context });
  },
  /** Ask me first, or Do the small things. Wed says what changes in the thread. */
  setMode(mode: Mode) {
    if (mode === state.mode) return;
    set({ mode });
    play(mode === 'small' ? 'modeSmall' : 'modeAsk');
  },
  setCheckIns(checkIns: CheckIns) {
    set({ checkIns });
  },
  /** Preview as the owner, someone who can suggest, or a viewer (the cards change). */
  setRole(role: Role) {
    set({ role });
  },
  /** Connects an app at an access level ('vendors', 'all', 'subscribed'). Gmail connects as a preview. */
  connect(app: AppId, level: string) {
    const status = app === 'gmail' ? 'preview' : 'connected';
    set({
      apps: { ...state.apps, [app]: { ...state.apps[app], status, level, since: Date.now() } },
    });
    if (app === 'gmail') play('gmail');
    if (app === 'calendar') play('calendar');
  },
  /** Disconnects an app. Gmail's emails go too, and the thread says so. */
  disconnect(app: AppId) {
    const wasOn = ['connected', 'preview'].includes(state.apps[app].status);
    set({ apps: { ...state.apps, [app]: initialApp(app) } });
    if (!wasOn || app !== 'gmail') return;
    set({
      items: state.items.map((item) =>
        item.kind === 'artifact' && item.id === 'emails' ? { ...item, gone: true } : item,
      ),
    });
    push({ kind: 'receipt', text: 'Disconnected Gmail. I forgot those emails.' });
  },
  /** The heart on a vendor card in the thread: on or off Wed's Jaago list. */
  toggleSaved(slug: string) {
    const saved = state.saved.includes(slug)
      ? state.saved.filter((s) => s !== slug)
      : [...state.saved, slug];
    set({ saved });
  },
  /** "Tell me when it's ready" on a coming-soon app; again to take it back. */
  notifyMe(app: AppId) {
    const current = state.apps[app];
    set({ apps: { ...state.apps, [app]: { ...current, notify: !current.notify } } });
  },
  forget(factId: string) {
    set({ facts: state.facts.filter((fact) => fact.id !== factId) });
  },
  /** Undo on a Forget: the fact goes back where it was. */
  restoreFact(fact: Fact, index: number) {
    if (state.facts.some((f) => f.id === fact.id)) return;
    const facts = [...state.facts];
    facts.splice(Math.min(index, facts.length), 0, fact);
    set({ facts });
  },
  /** Who sees a fact: the family, or only the one who told Wed. */
  setShared(factId: string, shared: boolean) {
    set({
      facts: state.facts.map((fact) => (fact.id === factId ? { ...fact, shared } : fact)),
    });
  },
  /** Forget everything (after the family confirms). */
  forgetAll() {
    set({ facts: [] });
  },
  /** Between "Shared with family" and "Only me". */
  toggleShared(factId: string) {
    set({
      facts: state.facts.map((fact) =>
        fact.id === factId ? { ...fact, shared: !fact.shared } : fact,
      ),
    });
  },
  /** The Wed tab's focus effect: true on focus, false on blur. */
  setOnWedTab(on: boolean) {
    if (on === state.onWedTab) return;
    if (!on) awayLineShown = false;
    set({ onWedTab: on });
  },
  /** An approval for the chat to scroll to; the chat sets it back to null. */
  setFocus(id: string | null) {
    set({ focus: id });
  },
  /** Replay the demo: stops every timer and starts from the seed again. */
  reset() {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    holds.clear();
    awayLineShown = false;
    state = { ...seed(), onWedTab: state.onWedTab };
    listeners.forEach((listener) => listener());
    resetListeners.forEach((listener) => listener());
  },
};

// ---------------------------------------------------------------------------
// Reading helpers

/** "9:41 PM" */
export function clockTime(at: number): string {
  const date = new Date(at);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** Cards waiting for a yes: the tab badge and the "2 need your OK" capsule. */
export function waitingCount(s: WedState): number {
  return s.approvals.filter((a) => a.stage === 'waiting').length;
}

/** Tasks running or waiting on someone ("Wed is working on 2 things"). */
export function activeTasks(s: WedState): Task[] {
  return s.tasks.filter((t) => t.state !== 'done');
}

/** The line an approval leaves once it's finished: "Asked 3 dhol players · 9:41 PM". */
export function receiptText(a: Approval): string {
  if (a.stage === 'declined') return 'Not sent. Ask me again any time.';
  const text = a.chose === 'alt' ? (a.altReceipt ?? a.receipt) : a.receipt;
  return a.preview && a.chose === 'verb' ? text : `${text} · ${clockTime(a.doneAt ?? Date.now())}`;
}

export type DoneEntry = {
  key: string;
  text: string;
  at: number;
  /** A preview's "yes", which moved nothing. */
  preview?: boolean;
};

/** Everything finished, newest first: Updates' Done list (receipts and finished cards). */
export function doneEntries(s: WedState): DoneEntry[] {
  const receipts = s.items.flatMap((item) =>
    item.kind === 'receipt' && !item.undone
      ? [{ key: item.key, text: item.text, at: item.at }]
      : [],
  );
  const cards = s.approvals.flatMap((a) =>
    a.stage === 'done'
      ? [
          {
            key: a.id,
            text: a.chose === 'alt' ? (a.altReceipt ?? a.receipt) : a.receipt,
            at: a.doneAt ?? a.createdAt,
            preview: a.preview && a.chose === 'verb',
          },
        ]
      : [],
  );
  return [...receipts, ...cards].sort((a, b) => b.at - a.at);
}

/** The words on an app's row: "Built in", "Connected", "Preview", "Coming soon" or "Off". */
export function appValue(app: AppState): string {
  switch (app.status) {
    case 'builtIn':
      return 'Always on';
    case 'connected':
      return 'Connected';
    case 'preview':
      return 'Preview';
    case 'soon':
      return 'Coming soon';
    case 'off':
      return 'Off';
  }
}

// ---------------------------------------------------------------------------
// The seed: yesterday's tasting question, still waiting for a yes

function initialApp(id: AppId): AppState {
  const group = APPS.find((app) => app.id === id)?.group;
  return { status: group === 'builtIn' ? 'builtIn' : group === 'connect' ? 'off' : 'soon' };
}

function seed(): WedState {
  const yesterday = Date.now() - 22 * 60 * 60 * 1000;
  const tasting: Approval = {
    id: 'tasting',
    kind: 'tour',
    // One idea in the title; when it is goes in the For line
    title: 'Book a tasting at Saffron Tandoor',
    verb: 'Book tasting',
    to: [
      { name: CATERER.name, photo: CATERER.photo, blurhash: CATERER.blurhash, slug: CATERER.slug },
    ],
    // The time held together, so it never breaks across lines
    forLine: 'Mehndi · tasting Sat,\u00A0Oct\u00A024,\u00A01\u00A0PM',
    message: `Sat Sri Akal! Could we come for a tasting on Sat, Oct 24 at 1 PM? We'll be 4 people, for our Mehndi on June 10, 2027. –\u2060\u00A0${FAMILY.signature}`,
    shares: "Your first name and phone number. That's all.",
    sharesShort: 'Shares your first name and phone',
    cost: 'Free for up to 4 people',
    undo: 'You can undo for 10 seconds',
    heldText: 'Asked Saffron Tandoor for the tasting',
    receipt: 'Booked a tasting at Saffron Tandoor, Sat, Oct 24 at 1 PM',
    then: { flow: 'tastingBooked', after: 1500 },
    stage: 'waiting',
    createdAt: yesterday,
  };
  const plan: TaskStep[] = [
    {
      label: 'Reading your chat with Saffron Tandoor',
      short: 'Reading your chat with Saffron Tandoor',
      sources: [{ kind: 'chat', label: 'Your chat', detail: 'Saffron Tandoor Catering' }],
      result: 'They do tastings on Saturdays',
    },
    {
      label: 'Checking their calendar for Saturdays',
      short: 'Checking their calendar',
      sources: [{ kind: 'calendar', label: 'Calendar', detail: 'Saffron Tandoor Catering' }],
      result: 'Sat, Oct 24 at 1 PM is open',
    },
  ];
  const task: Task = {
    id: 'tasting',
    title: "Checking Saffron Tandoor's tastings",
    short: 'Checking their calendar',
    plan,
    steps: stepsFor(plan, plan.length, 'done'),
    sources: [],
    now: plan.length - 1,
    state: 'done',
    summary: 'Worked 20 sec · checked their menus and calendar',
    startedAt: yesterday,
  };
  const items: ChatItem[] = [
    { kind: 'divider', text: 'Yesterday', key: 'seed-1', at: yesterday },
    {
      kind: 'me',
      text: "Can we taste Saffron Tandoor's food before we book them?",
      key: 'seed-2',
      at: yesterday,
    },
    { kind: 'work', taskId: 'tasting', key: 'seed-3', at: yesterday },
    {
      kind: 'wed',
      text: "Saffron Tandoor does tastings on Saturdays. Sat, Oct 24 at 1 PM is open, and it's free for up to 4 people.",
      key: 'seed-4',
      at: yesterday,
    },
    { kind: 'approval', id: 'tasting', key: 'seed-5', at: yesterday },
    {
      kind: 'wed',
      text: 'Their vegetarian Mehndi menu is $18 a person. I saved it to your Mehndi list.',
      key: 'seed-6',
      at: yesterday,
    },
  ];
  const apps = Object.fromEntries(APPS.map((app) => [app.id, initialApp(app.id)])) as Record<
    AppId,
    AppState
  >;
  return {
    items,
    history: items.length,
    approvals: [tasting],
    tasks: [task],
    mode: 'ask',
    checkIns: 'needed',
    role: 'owner',
    apps,
    facts: FACTS,
    draft: '',
    context: null,
    onWedTab: false,
    status: CAUGHT_UP,
    focus: null,
    saved: [],
  };
}

// ---------------------------------------------------------------------------

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) =>
    Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
