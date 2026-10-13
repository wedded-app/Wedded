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

type NavigationRef = ReturnType<typeof useNavigationContainerRef>;
// Just the parts of the navigation state openWed looks at
type Level = { key?: string; index?: number; routes?: { name: string; state?: Level }[] };

let navigation: NavigationRef | null = null;

/** Lets openWed() see where the app is. Called once, in the tabs layout. */
export function useWedNavigation() {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    navigation = ref;
  }, [ref]);
}

/**
 * Opens the Wed chat from anywhere (Home, a vendor page, a reel, Search, My
 * Wedding, a Wed page), with what the family is asking about already in
 * place: sets the context chip and fills the composer (or sends), then goes
 * to the Wed tab's chat, closing any Wed page or screen open over the tabs
 * on the way. Never sends anything that reaches a vendor: that always waits
 * on a card.
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

// router.navigate would stack a second chat (or a second set of tabs) on top
// of an open one, so: back to the chat at the bottom of the Wed tab's stack,
// then either switch tabs or close what's open over the tabs.
function goToChat() {
  const container = navigation?.isReady() ? (navigation.getRootState() as Level) : undefined;
  // Expo Router wraps the app's root stack in one '__root' route
  const wrapped = container?.routes?.length === 1 && container.routes[0].name === '__root';
  const root = wrapped ? container.routes?.[0].state : container;
  if (!navigation || !root?.routes) {
    router.navigate(WED_HREF);
    return;
  }
  const top = root.routes[root.index ?? root.routes.length - 1];
  const tabs = [...root.routes].reverse().find((route) => route.name === '(tabs)')?.state;
  const wedStack = tabs?.routes?.find((route) => route.name === 'wed')?.state;
  if (wedStack?.key && (wedStack.routes?.length ?? 0) > 1) {
    navigation.dispatch({ type: 'POP_TO_TOP', target: wedStack.key });
  }
  if (top?.name === '(tabs)') router.navigate(WED_HREF);
  else router.dismissTo(WED_HREF);
}
