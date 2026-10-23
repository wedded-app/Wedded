import { router, useNavigationContainerRef, type Href } from 'expo-router';
import { useEffect } from 'react';

import { wed, type WedContext } from './wed-store';

export type OpenWedOptions = {
  /** The chip above the composer ("About: Royal Orchard Banquet Hall"). Left as is when omitted. */
  about?: WedContext;
  /** Words for the composer. They wait there for Send, unless `send` is true. */
  ask?: string;
  /** Send `ask` at once (read-only things to try: starters, Ideas). */
  send?: boolean;
  /** An approval to scroll to and show, e.g. Look first on Home. */
  focus?: string;
};

/**
 * The Wed chat's address. Use this (or openWed) rather than the bare '/wed':
 * the dev server's typed-routes watcher on Windows writes new index routes
 * as '/wed/index', so the literal fails the typecheck until it restarts.
 */
export const WED_HREF = '/wed' as string as Href;

/** A Wed page's Back with nothing to go back to (opened by its address): "Wed", to the chat. */
export const WED_BACK = { href: WED_HREF, label: 'Wed' };

// Wed's routes on the root stack (src/app/wed), and the screen that hands
// over to the chat when it's done (talking to Wed, from the bow)
const WED = 'wed';
const VOICE = 'wed-voice';

type NavigationRef = ReturnType<typeof useNavigationContainerRef>;
// Just the parts of the navigation state openWed looks at
type Level = { key?: string; index?: number; routes?: { name: string; state?: Level }[] };

let navigation: NavigationRef | null = null;

/** Lets openWed() see where the app is. Called once, in the root layout. */
export function useWedNavigation() {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    navigation = ref;
  }, [ref]);
}

/** The root stack's state, or undefined before the app's navigation is ready. */
function rootStack(): Level | undefined {
  const container = navigation?.isReady() ? (navigation.getRootState() as Level) : undefined;
  // Expo Router wraps the app's root stack in one '__root' route
  const wrapped = container?.routes?.length === 1 && container.routes[0].name === '__root';
  return wrapped ? container.routes?.[0].state : container;
}

/** Where Wed's sheet is on the root stack: -1 while it's closed. */
function wedAt(root: Level | undefined) {
  const routes = root?.routes ?? [];
  for (let i = routes.length - 1; i >= 0; i--) {
    if (routes[i].name === WED) return i;
  }
  return -1;
}

/**
 * Opens the Wed chat from anywhere (Home, a vendor page, a reel, Search, My
 * Wedding, a Wed page), with what the family is asking about already in
 * place: sets the context chip and fills the composer (or sends), then
 * slides Wed's sheet up over whatever is open. If Wed is already open, it
 * goes back to the chat instead, closing any Wed page or sheet over it.
 * Never sends anything that reaches a vendor: that always waits on a card.
 */
export function openWed({ about, ask, send = false, focus }: OpenWedOptions = {}) {
  if (about !== undefined) wed.setContext(about);
  if (ask !== undefined) {
    if (send) wed.send(ask);
    else wed.setDraft(ask);
  }
  if (focus !== undefined) wed.setFocus(focus);
  goToChat();
}

// router.navigate would stack a second sheet on top of an open one, so with
// Wed open: back to the chat at the bottom of its stack, and close what's
// open over the sheet. Closed: the sheet slides up over the screen on top.
function goToChat() {
  const root = rootStack();
  if (!navigation || !root?.routes) {
    router.push(WED_HREF);
    return;
  }
  const at = wedAt(root);
  if (at < 0) {
    const top = root.routes[root.index ?? root.routes.length - 1];
    // Talking to Wed full screen hands over to the chat: Wed takes its place
    if (top?.name === VOICE) router.replace(WED_HREF);
    else router.push(WED_HREF);
    return;
  }
  const wedStack = root.routes[at].state;
  if (wedStack?.key && (wedStack.routes?.length ?? 0) > 1) {
    navigation.dispatch({ type: 'POP_TO_TOP', target: wedStack.key });
  }
  const above = root.routes.length - 1 - at;
  if (above > 0 && root.key) {
    navigation.dispatch({ type: 'POP', payload: { count: above }, target: root.key });
  }
}

/**
 * Opens a page that isn't one of Wed's (a vendor, a chat, Saved, a
 * comparison) from inside Wed: the sheet slides down and the page opens on
 * the tab or page Wed was over, and the bow brings Wed back as it was. iOS
 * can't push a page over a sheet in the same stack (it would open behind
 * it), so this is the way out of Wed on every platform. Outside Wed (Home's
 * cards) it simply opens the page.
 */
export function openFromWed(href: Href) {
  const root = rootStack();
  const at = wedAt(root);
  // Wed opened by its address, with nothing under it: the page takes its place
  if (at === 0) {
    router.replace(href);
    return;
  }
  if (navigation && at > 0 && root?.routes && root.key) {
    navigation.dispatch({
      type: 'POP',
      payload: { count: root.routes.length - at },
      target: root.key,
    });
  }
  // Expo Router queues this, so it lands on the stack as it is once Wed has gone
  router.push(href);
}
