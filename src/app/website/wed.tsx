import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useEvent } from '@/data/reference';
import {
  useGuestTipSuggestions,
  usePublishSite,
  useSetEventSiteDetails,
  useSetSiteItems,
  useUpdateSite,
  type SitePage,
} from '@/data/website';
import { ShimmerText } from '@/features/wed/shimmer-text';
import { WedMark } from '@/features/wed/wed-mark';
import { useSiteFonts } from '@/features/website/fonts';
import { SiteCover } from '@/features/website/site-cover';
import type { MissingPart } from '@/features/website/site-helpers';
import {
  matchSiteAsk,
  undoActions,
  wordActions,
  type ChangeLine,
  type SiteAction,
  type WedReply,
} from '@/features/website/site-wed';
import { useWebsite } from '@/features/website/use-website';
import { WED_SUGGESTIONS } from '@/features/website/website-ask';
import { closeWebsiteSheet } from '@/features/website/website-sheet';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

type Turn = {
  id: number;
  ask: string;
  reply: WedReply | null;
  state:
    'thinking' | 'waiting' | 'applying' | 'applied' | 'undoing' | 'undone' | 'declined' | 'failed';
  undo?: SiteAction[];
};

/**
 * Wed in the website builder: the family asks in their own words ("make it
 * maroon and gold", "add what to wear"), and Wed answers with the change on
 * a card, the cover before and after for a new look. Nothing changes until
 * they tap Apply; Undo puts it back. Scripted until Wed's brain (#124).
 */
export default function WebsiteWedScreen() {
  const { t } = useLocale();
  const website = useWebsite();
  const fontsReady = useSiteFonts();
  let content;
  if (website.status === 'ready' && fontsReady && website.canEdit) {
    content = <Thread site={website.site} weddingId={website.weddingId} />;
  } else if (website.status === 'error') {
    content = <StateView state="error" onRetry={website.retry} />;
  } else if (website.status === 'loading' || !fontsReady) {
    content = <StateView state="loading" />;
  } else {
    content = <StateView state="empty" icon="globe-outline" message={t('website.cantMake')} />;
  }
  return (
    <Screen edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <SheetHeader
          onClose={closeWebsiteSheet}
          title={t('website.wed.title')}
          leading={<WedMark size={26} color="ombre" />}
        />
      </View>
      {content}
    </Screen>
  );
}

function Thread({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const sx = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const type = useTypeStyle({ variant: 'body' });
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const tips = useGuestTipSuggestions(site.events.map((e) => e.slug));
  const update = useUpdateSite(site.slug);
  const setItems = useSetSiteItems(site.slug);
  const setDetails = useSetEventSiteDetails(site.slug);
  const publish = usePublishSite(site.slug);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typed, setTyped] = useState('');
  const asked = useRef(false);
  const scroll = useRef<ScrollView>(null);
  // The site as it is now, for the next answer and for Undo
  const current = useRef(site);
  useEffect(() => {
    current.current = site;
  }, [site]);

  const patch = (id: number, change: Partial<Turn>) =>
    setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)));

  const send = (text: string) => {
    const words = text.trim();
    if (!words) return;
    selectionHaptic();
    const id = Date.now();
    setTyped('');
    setTurns((all) => [...all, { id, ask: words, reply: null, state: 'thinking' }]);
    // A moment of "looking", as Wed does, then the answer
    setTimeout(() => {
      const reply = matchSiteAsk(
        words,
        current.current,
        (tips.data ?? []).map((tip) => tip.tip),
      );
      patch(id, { reply, state: 'waiting' });
    }, 700);
  };

  useEffect(() => {
    if (ask && !asked.current && !tips.isPending) {
      asked.current = true;
      send(ask);
    }
    // send is stable enough for a one-time first ask
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, tips.isPending]);

  const run = async (actions: SiteAction[]) => {
    for (const a of actions) {
      if (a.kind === 'update') await update.mutateAsync({ weddingId, changes: a.changes });
      else if (a.kind === 'items')
        await setItems.mutateAsync({ weddingId, kind: a.list, list: a.items });
      else if (a.kind === 'event') {
        await setDetails.mutateAsync({ weddingId, eventSlug: a.eventSlug, details: a.details });
      } else await publish.mutateAsync({ weddingId, publish: a.kind === 'publish' });
    }
  };

  const apply = async (turn: Turn, actions: SiteAction[]) => {
    const worded = wordActions(actions, t, current.current.title);
    const undo = undoActions(worded, current.current);
    patch(turn.id, { state: 'applying' });
    try {
      await run(worded);
      successHaptic();
      patch(turn.id, { state: 'applied', undo });
    } catch {
      patch(turn.id, { state: 'failed' });
    }
  };
  const revert = async (turn: Turn) => {
    if (!turn.undo) return;
    patch(turn.id, { state: 'undoing' });
    try {
      await run(turn.undo);
      patch(turn.id, { state: 'undone' });
    } catch {
      patch(turn.id, { state: 'applied' });
    }
  };

  return (
    <KeyboardAvoidingView style={sx.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        style={sx.fill}
        contentContainerStyle={sx.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {turns.length === 0 && (
          <View style={sx.intro}>
            <AppText variant="title">{t('website.wed.hello')}</AppText>
            <AppText color="text2">{t('website.wed.intro')}</AppText>
            <View style={sx.chips}>
              {WED_SUGGESTIONS.map((key) => (
                <Chip key={key} role="button" label={t(key)} onPress={() => send(t(key))} />
              ))}
            </View>
          </View>
        )}
        {turns.map((turn) => (
          <View key={turn.id} style={sx.turn}>
            <View style={sx.bubble}>
              <AppText color="onPrimary">{turn.ask}</AppText>
            </View>
            {turn.state === 'thinking' || !turn.reply ? (
              <ShimmerText text={t('website.wed.looking')} active />
            ) : (
              <Reply
                turn={turn}
                reply={turn.reply}
                site={site}
                onApply={(actions) => void apply(turn, actions)}
                onDecline={() => patch(turn.id, { state: 'declined' })}
                onUndo={() => void revert(turn)}
                onAsk={send}
              />
            )}
          </View>
        ))}
      </ScrollView>
      <View style={[sx.composer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => send(typed)}
          placeholder={t('website.wed.placeholder')}
          placeholderTextColor={Colors.text2}
          accessibilityLabel={t('website.wed.placeholder')}
          returnKeyType="send"
          maxFontSizeMultiplier={type.maxFontSizeMultiplier}
          style={[
            sx.input,
            { fontFamily: type.fontFamily, fontSize: type.fontSize, color: Colors.text },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('website.wed.send')}
          disabled={!typed.trim()}
          onPress={() => send(typed)}
          hitSlop={8}
        >
          <Icon
            name="arrow-up-circle"
            size={36}
            color={typed.trim() ? Colors.text : Colors.textDisabled}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Reply({
  turn,
  reply,
  site,
  onApply,
  onDecline,
  onUndo,
  onAsk,
}: {
  turn: Turn;
  reply: WedReply;
  site: SitePage;
  onApply: (actions: SiteAction[]) => void;
  onDecline: () => void;
  onUndo: () => void;
  onAsk: (text: string) => void;
}) {
  const sx = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const [width, setWidth] = useState(0);

  if (reply.kind === 'help') {
    return (
      <View style={sx.reply}>
        <AppText>{t('website.wed.help')}</AppText>
        <View style={sx.chips}>
          {WED_SUGGESTIONS.map((key) => (
            <Chip key={key} role="button" label={t(key)} onPress={() => onAsk(t(key))} />
          ))}
        </View>
      </View>
    );
  }
  if (reply.kind === 'nothing') {
    return (
      <View style={sx.reply}>
        <AppText>{t(reply.sayKey)}</AppText>
      </View>
    );
  }
  if (reply.kind === 'open') {
    return (
      <View style={sx.reply}>
        <AppText>{t(reply.sayKey)}</AppText>
        <Button
          variant="neutral"
          label={t(reply.buttonKey)}
          onPress={() => router.push(reply.href as Href)}
        />
      </View>
    );
  }
  if (reply.kind === 'missing') {
    return (
      <View style={sx.reply}>
        <AppText>
          {reply.parts.length === 0
            ? t('website.wed.say.nothingMissing')
            : t('website.wed.say.missing', { count: reply.parts.length })}
        </AppText>
        {reply.parts.length > 0 && (
          <View style={sx.card}>
            {reply.parts.slice(0, 8).map((part, i) => (
              <MissingRow key={i} part={part} />
            ))}
          </View>
        )}
      </View>
    );
  }

  const { proposal } = reply;
  const done = turn.state === 'applied';
  return (
    <View style={sx.reply}>
      <AppText>{t(proposal.sayKey)}</AppText>
      <View
        style={sx.card}
        onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      >
        {proposal.look && width > 0 && (
          <View style={sx.beforeAfter}>
            {(['now', 'after'] as const).map((which) => {
              const w = (width - Spacing.lg * 2 - Spacing.md) / 2;
              return (
                <View key={which} style={sx.side}>
                  <View style={[sx.thumb, { width: w, pointerEvents: 'none' }]}>
                    <SiteCover
                      data={site}
                      width={w}
                      mini
                      designId={which === 'after' ? proposal.look?.design : undefined}
                      paletteId={which === 'after' ? proposal.look?.palette : undefined}
                      id={`wed-${turn.id}-${which}`}
                      minHeight={200}
                    />
                  </View>
                  <AppText variant="caption" color="text2" style={sx.centered}>
                    {which === 'now' ? t('website.wed.now') : t('website.wed.after')}
                  </AppText>
                </View>
              );
            })}
          </View>
        )}
        {proposal.lines.map((line, i) => (
          <View key={i} style={sx.line}>
            <View style={[sx.dot, { backgroundColor: Colors.primary }]} />
            <LineText line={line} />
          </View>
        ))}
        {turn.state === 'waiting' && (
          <View style={sx.buttons}>
            <Button label={t('website.wed.apply')} onPress={() => onApply(proposal.actions)} />
            <Button
              variant="plain"
              labelColor="text2"
              label={t('website.wed.notNow')}
              onPress={onDecline}
            />
          </View>
        )}
        {(turn.state === 'applying' || turn.state === 'undoing') && (
          <ShimmerText
            text={turn.state === 'applying' ? t('website.wed.applying') : t('website.wed.undoing')}
            active
          />
        )}
        {done && (
          <View style={sx.doneRow}>
            <Icon name="checkmark-circle" size={22} color={Colors.success} />
            <AppText style={sx.grow}>{t('website.wed.applied')}</AppText>
            <Button
              variant="plain"
              label={t('website.wed.undo')}
              onPress={onUndo}
              style={sx.undo}
            />
          </View>
        )}
        {turn.state === 'undone' && <AppText color="text2">{t('website.wed.undone')}</AppText>}
        {turn.state === 'declined' && <AppText color="text2">{t('website.wed.declined')}</AppText>}
        {turn.state === 'failed' && <AppText color="error">{t('website.wed.failed')}</AppText>}
      </View>
    </View>
  );
}

/** One change on the card, its event and ideas put into words. */
function LineText({ line }: { line: ChangeLine }) {
  const { t } = useLocale();
  const eventSlug = typeof line.options?.event === 'string' ? line.options.event : '';
  const event = useEvent(eventSlug);
  const options: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(line.options ?? {})) {
    if (key === 'event') options.event = event.data ? localized(event.data.name) : '';
    else
      options[key] = typeof value === 'string' && value.startsWith('website.') ? t(value) : value;
  }
  return <AppText style={{ flex: 1 }}>{t(line.key, options)}</AppText>;
}

/** Something a guest would miss, with the way to fix it. */
function MissingRow({ part }: { part: MissingPart }) {
  const sx = useStyles();
  const { t } = useLocale();
  const eventSlug = 'eventSlug' in part ? part.eventSlug : '';
  const event = useEvent(eventSlug);
  const name = event.data ? localized(event.data.name) : '';
  const fix: Record<MissingPart['kind'], Href> = {
    cover: '/website/cover',
    welcome: '/website/welcome',
    rsvpBy: '/website/rsvp',
    published: '/website',
    eventDate: '/guest-details',
    eventPlace: '/guest-details',
    eventDress: '/website/events',
  };
  return (
    <View style={sx.missing}>
      <AppText style={sx.grow}>{t(`website.wed.missing.${part.kind}`, { event: name })}</AppText>
      <Button
        variant="secondary"
        label={t('website.wed.fix')}
        onPress={() => router.push(fix[part.kind])}
        style={sx.fix}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  header: {
    paddingHorizontal: Sizes.pageGutter,
  },
});

const useStyles = makeStyles((Colors) => ({
  fill: {
    flex: 1,
  },
  thread: {
    gap: Spacing.xl,
    padding: Sizes.pageGutter,
    paddingBottom: Spacing.xxl,
  },
  intro: {
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  turn: {
    gap: Spacing.md,
  },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    backgroundColor: Colors.primaryFill,
  },
  reply: {
    gap: Spacing.md,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  beforeAfter: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  side: {
    gap: Spacing.xs,
  },
  thumb: {
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  centered: {
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 9,
  },
  buttons: {
    gap: Spacing.xs,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
  undo: {
    width: 'auto',
    alignSelf: 'center',
  },
  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  fix: {
    width: 'auto',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    minHeight: Sizes.input,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface,
  },
}));
