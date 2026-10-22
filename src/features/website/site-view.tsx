import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';

import { useTypeStyle } from '@/components/app-text';
import { Spacing } from '@/constants/theme';
import { findInvitation } from '@/data/guests';
import { useEvent } from '@/data/reference';
import type { SiteEvent, SiteItem, SitePage, SiteSection } from '@/data/website';
import { formatTime } from '@/features/vendors/profile-format';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import {
  capsColor,
  dressColorName,
  siteDesign,
  sitePalette,
  type SiteDesign,
  type SitePalette,
} from './designs';
import { SiteCover } from './site-cover';
import { longDate, shortDay, visibleSections } from './site-helpers';

type Look = { design: SiteDesign; palette: SitePalette };

type SiteViewProps = {
  page: SitePage;
  width: number;
  topInset?: number;
  /** The family's own preview: marks events only invited guests see. */
  editing?: boolean;
};

/**
 * A wedding website as guests see it, from the cover to "Made with Wedded":
 * one scrolling page in the family's design. Put it in a ScrollView. Names
 * and headings use the design's type; everything a guest needs to read
 * (times, places, buttons) is plain large text that grows with the phone's
 * text size, for elders.
 */
export function SiteView({ page, width, topInset = 0, editing = false }: SiteViewProps) {
  const { t } = useLocale();
  const design = siteDesign(page.design);
  const palette = sitePalette(design, page.palette);
  const look = { design, palette };
  const sections = visibleSections(page);

  return (
    <View style={{ backgroundColor: palette.paper }}>
      <SiteCover data={page} width={width} topInset={topInset} id={`site-${page.slug}`} />
      {page.welcome ? (
        <View style={styles.welcome}>
          <Body look={look} center large>
            {page.welcome}
          </Body>
        </View>
      ) : null}
      <View style={styles.sections}>
        {sections.map((section, i) => (
          <View key={section} style={styles.section}>
            {i > 0 || page.welcome ? <Divider look={look} /> : null}
            <Section section={section} page={page} look={look} editing={editing} />
          </View>
        ))}
      </View>
      <View style={[styles.footer, { borderTopColor: palette.line }]}>
        <Body look={look} center soft small>
          {t('website.site.madeWith')}
        </Body>
      </View>
    </View>
  );
}

function Section({
  section,
  page,
  look,
  editing,
}: {
  section: SiteSection;
  page: SitePage;
  look: Look;
  editing: boolean;
}) {
  const { t } = useLocale();
  switch (section) {
    case 'family':
      return (
        <View style={styles.block}>
          <Caps look={look}>{page.familyTitle ?? t('website.site.familyTitle')}</Caps>
          {page.familyLines.map((line) => (
            <Heading key={line} look={look} size={22}>
              {line}
            </Heading>
          ))}
        </View>
      );
    case 'story':
      return (
        <View style={styles.block}>
          <Caps look={look}>{t('website.site.storyEyebrow')}</Caps>
          <Heading look={look}>{t('website.site.ourStory')}</Heading>
          {(page.story ?? '')
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((para, i) => (
              <Body key={i} look={look} center>
                {para.trim()}
              </Body>
            ))}
        </View>
      );
    case 'events':
      return (
        <View style={styles.block}>
          <Caps look={look}>
            {page.guest ? t('website.site.yourEvents') : t('website.site.eventsEyebrow')}
          </Caps>
          <Heading look={look}>{t('website.site.eventsTitle')}</Heading>
          {page.guest ? (
            <Body look={look} center soft>
              {t('website.site.invitedTo', { name: page.guest.name, count: page.events.length })}
            </Body>
          ) : null}
          <View style={styles.cards}>
            {page.events.map((event) => (
              <EventCard
                key={event.slug}
                event={event}
                look={look}
                editing={editing}
                guest={!!page.guest}
              />
            ))}
          </View>
        </View>
      );
    case 'rsvp':
      return <RsvpBlock page={page} look={look} />;
    case 'guide':
      return (
        <View style={styles.block}>
          <Caps look={look}>{t('website.site.guideEyebrow')}</Caps>
          <Heading look={look}>{page.guideTitle ?? t('website.site.goodToKnow')}</Heading>
          <View style={styles.tips}>
            {page.tips.map((tip, i) => (
              <View key={i} style={[styles.tip, { backgroundColor: look.palette.card }]}>
                <View style={[styles.bullet, { backgroundColor: look.palette.accent }]} />
                <View style={styles.grow}>
                  <Body look={look}>{tip.title}</Body>
                  {tip.body ? (
                    <Body look={look} soft small>
                      {tip.body}
                    </Body>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    case 'travel':
      return (
        <View style={styles.block}>
          <Caps look={look}>{t('website.site.travelEyebrow')}</Caps>
          <Heading look={look}>{t('website.site.travel')}</Heading>
          <View style={styles.cards}>
            {page.hotels.map((hotel, i) => (
              <ItemCard key={i} item={hotel} look={look} action={t('website.site.book')} />
            ))}
          </View>
        </View>
      );
    case 'livestream':
      return (
        <View style={styles.block}>
          <Caps look={look}>{t('website.site.liveEyebrow')}</Caps>
          <Heading look={look}>{t('website.site.livestream')}</Heading>
          {page.livestreamNote ? (
            <Body look={look} center>
              {page.livestreamNote}
            </Body>
          ) : null}
          <SiteButton
            look={look}
            label={t('website.site.watch')}
            onPress={() => openLink(page.livestreamUrl)}
          />
        </View>
      );
    case 'faq':
      return (
        <View style={styles.block}>
          <Caps look={look}>{t('website.site.faqEyebrow')}</Caps>
          <Heading look={look}>{t('website.site.faq')}</Heading>
          <View style={styles.faq}>
            {page.faq.map((qa, i) => (
              <View
                key={i}
                style={[
                  styles.qa,
                  i > 0 && { borderTopWidth: 1, borderTopColor: look.palette.line },
                ]}
              >
                <Body look={look} strong>
                  {qa.title}
                </Body>
                {qa.body ? (
                  <Body look={look} soft>
                    {qa.body}
                  </Body>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      );
  }
}

/** One event: when, where with directions, what to wear, and the guest's answer. */
function EventCard({
  event,
  look,
  editing,
  guest,
}: {
  event: SiteEvent;
  look: Look;
  editing: boolean;
  guest: boolean;
}) {
  const { t } = useLocale();
  const details = useEvent(event.slug);
  const name = details.data ? localized(details.data.name) : '';
  const clock = (time: string) => formatTime(time.slice(0, 5));
  const hours =
    event.startsAt && event.endsAt
      ? t('website.site.fromTo', { from: clock(event.startsAt), to: clock(event.endsAt) })
      : event.startsAt
        ? clock(event.startsAt)
        : null;
  const when = [event.date && shortDay(event.date), hours].filter(Boolean).join(' · ');
  const colorNames = event.dressColors
    .map((hex) => dressColorName(hex))
    .filter((key): key is string => !!key)
    .map((key) => t(key));

  return (
    <View style={[styles.card, { backgroundColor: look.palette.card }]}>
      <Heading look={look} size={24} left>
        {name}
      </Heading>
      {when ? (
        <Body look={look} strong>
          {when}
        </Body>
      ) : (
        <Body look={look} soft>
          {t('website.site.dateToCome')}
        </Body>
      )}
      {event.place ? (
        <View style={styles.placeRow}>
          <View style={styles.grow}>
            <Body look={look}>{[event.place, event.city].filter(Boolean).join(', ')}</Body>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('website.site.directionsTo', { place: event.place })}
            onPress={() => directions([event.place, event.city].filter(Boolean).join(', '))}
            hitSlop={8}
            style={({ pressed }) => [
              styles.directions,
              { borderColor: look.palette.ink, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Body look={look} strong small>
              {t('website.site.directions')}
            </Body>
          </Pressable>
        </View>
      ) : null}
      {event.dressCode || event.dressColors.length > 0 ? (
        <View style={styles.wear}>
          <Caps look={look} small left>
            {t('website.site.whatToWear')}
          </Caps>
          <View
            style={styles.wearRow}
            accessible
            accessibilityLabel={[event.dressCode, colorNames.join(', ')].filter(Boolean).join('. ')}
          >
            {event.dressColors.map((hex) => (
              <View
                key={hex}
                style={[styles.swatch, { backgroundColor: hex, borderColor: look.palette.line }]}
              />
            ))}
            {event.dressCode ? (
              <View style={styles.grow}>
                <Body look={look}>{event.dressCode}</Body>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {event.note ? (
        <Body look={look} soft>
          {event.note}
        </Body>
      ) : null}
      {guest && event.rsvp ? (
        <View style={[styles.tag, { borderColor: look.palette.accent }]}>
          <Body look={look} small strong>
            {event.rsvp === 'yes'
              ? t('website.site.saidYes', { count: event.coming ?? 1 })
              : event.rsvp === 'no'
                ? t('website.site.saidNo')
                : t('website.site.notAnswered')}
          </Body>
        </View>
      ) : null}
      {editing && !event.shownPublicly ? (
        <View style={[styles.tag, { borderColor: look.palette.soft }]}>
          <Body look={look} small soft>
            {t('website.site.onlyInvited')}
          </Body>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Answering: a guest on their own link goes to their RSVP page; anyone else
 * types the phone number or email the family has for them (the wedding's
 * shared RSVP link, #337) and is taken to theirs.
 */
function RsvpBlock({ page, look }: { page: SitePage; look: Look }) {
  const { t } = useLocale();
  const type = useTypeStyle({ variant: 'bodyLg' });
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const replyBy = page.rsvpBy ? t('website.site.replyBy', { date: longDate(page.rsvpBy) }) : null;

  const find = async () => {
    if (!page.rsvpLink || !contact.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const token = await findInvitation(page.rsvpLink, contact);
      if (token) router.push(`/rsvp/${token}`);
      else setProblem(t('website.site.notFound'));
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setProblem(
        message.includes('find_limit') ? t('website.site.findLimit') : t('website.site.findFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.block}>
      <Caps look={look}>{t('website.site.rsvpEyebrow')}</Caps>
      <Heading look={look}>{t('website.site.rsvpTitle')}</Heading>
      {replyBy ? (
        <Body look={look} center soft>
          {replyBy}
        </Body>
      ) : null}
      {page.guest ? (
        <SiteButton
          look={look}
          label={t('website.site.answer')}
          onPress={() => router.push(`/rsvp/${page.guest?.token}`)}
        />
      ) : (
        <View style={styles.find}>
          <Body look={look} center>
            {t('website.site.findHint')}
          </Body>
          <TextInput
            value={contact}
            onChangeText={setContact}
            onSubmitEditing={() => void find()}
            placeholder={t('website.site.findLabel')}
            placeholderTextColor={look.palette.soft}
            accessibilityLabel={t('website.site.findLabel')}
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            maxFontSizeMultiplier={type.maxFontSizeMultiplier}
            style={[
              styles.input,
              {
                fontFamily: type.fontFamily,
                fontSize: type.fontSize,
                color: look.palette.ink,
                borderColor: look.palette.soft,
                backgroundColor: look.palette.card,
              },
            ]}
          />
          {problem ? (
            <Body look={look} center small strong>
              {problem}
            </Body>
          ) : null}
          <SiteButton
            look={look}
            label={t('website.site.find')}
            busy={busy}
            onPress={() => void find()}
          />
        </View>
      )}
    </View>
  );
}

function ItemCard({ item, look, action }: { item: SiteItem; look: Look; action: string }) {
  return (
    <View style={[styles.card, { backgroundColor: look.palette.card }]}>
      <Heading look={look} size={22} left>
        {item.title}
      </Heading>
      {item.body ? <Body look={look}>{item.body}</Body> : null}
      {item.link ? (
        <SiteButton look={look} label={action} onPress={() => openLink(item.link)} />
      ) : null}
    </View>
  );
}

function openLink(url: string | null) {
  if (url) void Linking.openURL(url);
}

function directions(place: string) {
  const destination = encodeURIComponent(place);
  void Linking.openURL(
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${destination}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
  );
}

/** A thin rule with a small diamond in the accent, between parts. */
function Divider({ look }: { look: Look }) {
  return (
    <View style={styles.divider} accessible={false}>
      <View style={[styles.rule, { backgroundColor: look.palette.line }]} />
      <View style={[styles.diamond, { backgroundColor: look.palette.accent }]} />
      <View style={[styles.rule, { backgroundColor: look.palette.line }]} />
    </View>
  );
}

/** Small spaced capitals over a part, in the accent. */
function Caps({
  look,
  children,
  small,
  left,
}: {
  look: Look;
  children: string;
  small?: boolean;
  left?: boolean;
}) {
  const size = small ? 11 : 12;
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={{
        fontFamily: look.design.capsFont,
        fontSize: size,
        lineHeight: size * 1.5,
        letterSpacing: size * 0.2,
        color: capsColor(look.palette),
        textAlign: left ? 'left' : 'center',
      }}
    >
      {children.toUpperCase()}
    </Text>
  );
}

/** A heading in the design's serif. */
function Heading({
  look,
  children,
  size = 30,
  left,
}: {
  look: Look;
  children: string;
  size?: number;
  left?: boolean;
}) {
  const s = size * look.design.headingScale;
  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={1.6}
      style={{
        fontFamily: look.design.headingFont,
        fontSize: s,
        lineHeight: s * 1.2,
        color: look.palette.ink,
        textAlign: left ? 'left' : 'center',
      }}
    >
      {children}
    </Text>
  );
}

/** Plain text guests read: Plus Jakarta Sans at the app's body size or larger. */
function Body({
  look,
  children,
  center,
  soft,
  strong,
  small,
  large,
}: {
  look: Look;
  children: ReactNode;
  center?: boolean;
  soft?: boolean;
  strong?: boolean;
  small?: boolean;
  large?: boolean;
}) {
  const { maxFontSizeMultiplier, ...type } = useTypeStyle({
    variant: large ? 'bodyLg' : small ? 'label' : 'body',
    weight: strong ? 600 : 400,
  });
  const style: TextStyle = {
    ...type,
    color: soft ? look.palette.soft : look.palette.ink,
    textAlign: center ? 'center' : 'left',
  };
  return (
    <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={style}>
      {children}
    </Text>
  );
}

/** The site's one kind of button: an ink capsule, 52 tall. */
export function SiteButton({
  look,
  label,
  onPress,
  busy,
}: {
  look: Look;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const type = useTypeStyle({ variant: 'button' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.palette.ink, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={look.palette.onInk} />
      ) : (
        <Text
          maxFontSizeMultiplier={type.maxFontSizeMultiplier}
          style={{
            fontFamily: type.fontFamily,
            fontSize: type.fontSize,
            lineHeight: type.lineHeight,
            color: look.palette.onInk,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  welcome: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  sections: {
    paddingHorizontal: Spacing.xl,
  },
  section: {
    gap: Spacing.xxl,
    paddingTop: Spacing.xxl,
  },
  block: {
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  cards: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  card: {
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  directions: {
    minHeight: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  wear: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  wearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  tips: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  tip: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  bullet: {
    width: 8,
    height: 8,
    marginTop: 9,
    transform: [{ rotate: '45deg' }],
  },
  faq: {
    marginTop: Spacing.sm,
  },
  qa: {
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  find: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
  },
  button: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  diamond: {
    width: 7,
    height: 7,
    transform: [{ rotate: '45deg' }],
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  footer: {
    marginTop: Spacing.xxxl,
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.xl,
    borderTopWidth: 1,
  },
});
