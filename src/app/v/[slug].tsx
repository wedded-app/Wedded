import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { GlassButton } from '@/components/glass-button';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { IconLine } from '@/components/icon-line';
import { NavBar, useNavScroll, useNavTop } from '@/components/nav';
import { SampleTag } from '@/components/sample-tag';
import { StateView } from '@/components/state-view';
import { appLink } from '@/constants/links';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useMyBusinesses } from '@/data/business';
import { useStartConversation } from '@/data/chat';
import { useSavedEventsFor, useSaveVendor } from '@/data/saved';
import { useVendorLinks } from '@/data/vendor-links';
import { useVendorPhotos } from '@/data/vendor-media';
import { trackVendorActivity, useVendorPublicStats } from '@/data/vendor-stats';
import { useVendor } from '@/data/vendors';
import { useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { chooseBusiness } from '@/features/business/use-current-business';
import { SavedToastHost } from '@/features/saved/saved-toast';
import { ForYourEvent } from '@/features/vendors/date-ticket';
import { FactTiles } from '@/features/vendors/fact-tiles';
import { PhotoPager } from '@/features/vendors/photo-pager';
import { ALL_NORCAL_MILES, factLabels, usd } from '@/features/vendors/profile-format';
import {
  ContactList,
  GoodToKnow,
  LinkedVendors,
  MenusSection,
  PageHeading,
  PhotoGrid,
  PriceSection,
  RealWeddings,
  type ContactLine,
} from '@/features/vendors/profile-sections';
import { shareVendor } from '@/features/vendors/share';
import { VendorReels } from '@/features/vendors/vendor-reels';
import { VisitSection } from '@/features/vendors/visit-section';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

/**
 * S9 Vendor profile, rebuilt from Fezy's mockup (2026-11-11). Deep link:
 * /v/{slug}. Opens over the tabs. Their photos run edge to edge at the top,
 * swiped sideways, with Back, Share and Save floating on them; the page
 * rises over the photo. Right under the name come the numbers (seats,
 * price), the date ticket and Wed's line; then their reels, Visit the hall
 * for venues, Price, Good to know, Photos and Contact as plain rows. No
 * buttons at the top: message, call and directions are rows under Contact,
 * and one solid bar at the bottom shows the price and Ask for a quote.
 */
export default function VendorProfileScreen() {
  const Colors = useColors();
  const styles = useStyles();
  // `event` is set when they came from an event, so Save and Ask use it.
  const { slug = '', event } = useLocalSearchParams<{ slug: string; event?: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroll = useNavScroll();
  // A draft's page is hidden from everyone, its own people too, so say it's theirs
  const myBusinesses = useMyBusinesses();
  const mine = myBusinesses.businesses.find((b) => b.slug === slug);
  const navTop = useNavTop();
  const reduceMotion = useReducedMotion();
  const [barHeight, setBarHeight] = useState(0);
  const vendor = useVendor(slug);
  const vendorId = vendor.data?.id ?? '';
  // "Saved by N families", "Replied to N of M": null until 5+ people are behind them.
  const stats = useVendorPublicStats(vendorId);
  const { requireSignIn } = useSession();
  const startChat = useStartConversation();
  // Suggesters on the family's shared plan suggest vendors rather than book them
  const canSuggest = useMyWeddings().data?.[0]?.role === 'suggester';

  // One anonymous view per visit (trackVendorActivity de-dupes per session).
  useEffect(() => {
    if (vendorId) trackVendorActivity(vendorId, 'view');
  }, [vendorId]);
  const links = useVendorLinks(vendorId);
  const photos = useVendorPhotos(vendorId);
  const { toggleSave } = useSaveVendor();
  const saved = useSavedEventsFor(vendorId).length > 0;

  // The photos fill the top: a little taller than the phone is wide, less on wide screens.
  const pageWidth = Math.min(width, 480);
  const heroHeight = Math.round(pageWidth * 0.82);

  // Pulling down stretches the photo; scrolling up slides it at half speed.
  // Capture only the shared value: the scroll object's onScroll can't go to the UI thread
  const { scrollY } = scroll;
  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    if (reduceMotion) return {};
    return {
      transform: [
        { translateY: y < 0 ? y / 2 : y * 0.4 },
        { scale: interpolate(y, [-heroHeight, 0], [2, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  // The bar's backdrop and small title arrive as the name scrolls under it.
  // The name's position is measured below the photos, so add them back.
  const onTitleLayout = (layout: LayoutChangeEvent, above: number) => {
    const { y, height } = layout.nativeEvent.layout;
    scroll.setCollapseAt(above + y + height - navTop);
  };

  // Alert does nothing in a web browser, so the web uses the browser's own.
  const notify = (message: string) =>
    Platform.OS === 'web' ? globalThis.alert(message) : Alert.alert(message);
  const open = (url: string) => {
    Linking.openURL(url).catch(() => notify(t('vendor.openFailed')));
  };
  const ask = () =>
    vendor.data &&
    router.push({
      pathname: '/ask',
      params: event ? { vendorId: vendor.data.id, event } : { vendorId: vendor.data.id },
    });

  let hero = null;
  let body;
  // Not found waits for their businesses too, so their own draft never says "isn't listed"
  if (vendor.isPending || (!vendor.data && myBusinesses.isPending)) {
    body = <StateView state="loading" style={{ marginTop: navTop }} />;
  } else if (vendor.isError) {
    body = (
      <StateView
        state="error"
        onRetry={() => void vendor.refetch()}
        style={{ marginTop: navTop }}
      />
    );
  } else if (!vendor.data) {
    body = (
      <StateView
        state="empty"
        icon="storefront-outline"
        message={mine ? t('business.notLive') : t('vendor.notFound')}
        action={
          mine
            ? {
                label: t('business.myPage.finishIt'),
                onPress: () => {
                  chooseBusiness(mine.id);
                  router.push('/business/listing');
                },
              }
            : { label: t('common.goHome'), onPress: () => router.navigate('/') }
        }
        style={{ marginTop: navTop }}
      />
    );
  } else {
    const v = vendor.data;
    const name = localized(v.name);
    const tagline = v.tagline?.trim() || null;
    const bio = v.bio?.trim() || null;
    // Halls, gurdwaras and other venues take visits before booking (demo step 3).
    const isVenue = v.categories.some((category) => category.groupSlug === 'venues');
    const allPhotos = photos.data ?? [];
    const cover = allPhotos.find((photo) => photo.isCover) ?? allPhotos[0];
    const languages = v.languages.map((language) => localized(language)).join(', ');
    const categoryNames = v.categories.map((category) => localized(category.name));
    const category = categoryNames[0] ?? null;
    const travel = v.addressLine
      ? null
      : (v.serviceRadiusMiles >= ALL_NORCAL_MILES
          ? t('vendor.travelsNorcal')
          : t('vendor.travelsUpTo', { miles: v.serviceRadiusMiles })) +
        (v.willTravel && v.travelNote ? ` ${v.travelNote}` : '');
    const facts = [
      ...factLabels(v.facts, t),
      ...(languages ? [t('vendor.speaks', { languages })] : []),
      ...(travel ? [travel] : []),
    ];

    // Contact: every way to reach them, as rows that do what they say
    const message = () =>
      requireSignIn(() =>
        startChat.mutate(v.id, {
          onSuccess: (conversationId) =>
            router.push({ pathname: '/chat/[id]', params: { id: conversationId } }),
          onError: () => notify(t('chat.startFailed')),
        }),
      );
    const call = (phone: string) => {
      // A confirm sheet showing the number prevents pocket calls (vision S9).
      // On the web the phone asks before a tel: link calls, and Alert does
      // nothing there, so the link opens straight away.
      if (Platform.OS === 'web') {
        trackVendorActivity(v.id, 'call');
        open(`tel:${phone}`);
        return;
      }
      Alert.alert(t('vendor.callTitle', { name }), formatPhone(phone), [
        { text: t('vendor.cancel'), style: 'cancel' },
        {
          text: t('vendor.call'),
          onPress: () => {
            trackVendorActivity(v.id, 'call');
            open(`tel:${phone}`);
          },
        },
      ]);
    };
    const contacts: ContactLine[] = [
      {
        icon: 'chatbubbles-outline',
        title: t('vendor.contactRows.message', { name }),
        subtitle: t('vendor.contactRows.messageSub'),
        spoken: t('chat.messageSpoken', { name }),
        onPress: message,
      },
    ];
    if (v.callPhone) {
      const phone = v.callPhone;
      contacts.push({
        icon: 'call-outline',
        title: formatPhone(phone),
        subtitle: t('vendor.call'),
        spoken: t('vendor.callSpoken', { name, phone: formatPhone(phone) }),
        onPress: () => call(phone),
      });
    }
    if (v.textPhone && v.textPhone !== v.callPhone) {
      const phone = v.textPhone;
      contacts.push({
        icon: 'chatbubble-outline',
        title: formatPhone(phone),
        subtitle: t('vendor.text'),
        spoken: t('vendor.textSpoken', { name, phone: formatPhone(phone) }),
        onPress: () => {
          trackVendorActivity(v.id, 'text');
          open(`sms:${phone}`);
        },
      });
    }
    if (v.whatsappPhone) {
      const phone = v.whatsappPhone;
      contacts.push({
        icon: 'logo-whatsapp',
        title: formatPhone(phone),
        subtitle: t('vendor.whatsapp'),
        spoken: t('vendor.whatsappSpoken', { name }),
        onPress: () => {
          trackVendorActivity(v.id, 'whatsapp');
          open(`https://wa.me/${phone.replace(/\D/g, '')}`);
        },
      });
    }
    if (v.addressLine) {
      const address = v.addressLine;
      contacts.push({
        icon: 'location-outline',
        title: address,
        subtitle: t('vendor.directions'),
        spoken: `${address}. ${t('vendor.directionsSpoken', { name })}`,
        onPress: () => {
          const destination = encodeURIComponent(address);
          trackVendorActivity(v.id, 'directions');
          open(
            Platform.OS === 'ios'
              ? `https://maps.apple.com/?daddr=${destination}`
              : `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
          );
        },
      });
    } else {
      contacts.push({ icon: 'location-outline', title: t('vendor.basedIn', { city: v.city }) });
    }
    if (v.instagramHandle) {
      const handle = v.instagramHandle;
      contacts.push({
        icon: 'logo-instagram',
        title: `@${handle}`,
        subtitle: t('vendor.instagram'),
        spoken: t('vendor.instagramSpoken', { name }),
        onPress: () => {
          trackVendorActivity(v.id, 'instagram');
          open(`https://instagram.com/${handle}`);
        },
      });
    }
    if (v.websiteUrl) {
      const site = v.websiteUrl;
      contacts.push({
        icon: 'globe-outline',
        title: site,
        subtitle: t('vendor.website'),
        onPress: () => open(/^https?:\/\//.test(site) ? site : `https://${site}`),
      });
    }

    // Without photos, a shorter band with the category's icon.
    const heroBand = cover ? heroHeight : Math.round(heroHeight * 0.55);
    hero = cover ? (
      <View style={[styles.hero, { height: heroHeight }]}>
        <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
          <PhotoPager
            vendorId={v.id}
            photos={[cover, ...allPhotos.filter((photo) => photo !== cover)]}
            width={pageWidth}
            height={heroHeight}
            dotsBottom={SHEET_OVERLAP + Spacing.lg}
          />
        </Animated.View>
      </View>
    ) : (
      <View style={[styles.hero, styles.heroEmpty, { height: heroBand }]}>
        <Icon
          name={groupIcon(v.categories[0]?.groupSlug ?? '')}
          size={Sizes.iconLarge + 16}
          color={Colors.primary}
        />
      </View>
    );

    body = (
      <>
        {/* The web page people land on from a QR code or a shared link. */}
        <Head>
          <title>{category ? t('vendor.pageTitle', { name, category, city: v.city }) : name}</title>
          {tagline ? <meta name="description" content={tagline} /> : null}
        </Head>

        <View style={styles.top}>
          <View style={styles.titleBlock} onLayout={(layout) => onTitleLayout(layout, heroBand)}>
            <View style={styles.kicker}>
              <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
                {[category, v.city].filter(Boolean).join(' · ').toUpperCase()}
              </AppText>
              <SampleTag show={v.isSample} />
            </View>
            <AppText variant="display" accessibilityRole="header" style={styles.name}>
              {name}
            </AppText>
            {v.foundingNumber != null && (
              <View style={styles.founding}>
                <Icon name="ribbon-outline" size={17} color={Colors.kesari} weight="semibold" />
                <AppText variant="label" weight={600} color="kesari">
                  {t('vendor.foundingNumber', { number: v.foundingNumber })}
                </AppText>
              </View>
            )}
            {/* Quiet trust lines, shown only once 5+ families are behind each. */}
            {stats.data?.bookedBy != null && (
              <IconLine icon="checkmark-circle-outline" color="text2">
                {t('vendorStats.bookedBy', { count: stats.data.bookedBy })}
              </IconLine>
            )}
            {stats.data?.savedBy != null && (
              <IconLine icon="heart-outline" color="text2">
                {t('vendorStats.savedBy', { count: stats.data.savedBy })}
              </IconLine>
            )}
            {stats.data?.replied != null && (
              <IconLine icon="chatbubble-outline" color="text2">
                {t('vendorStats.replied', stats.data.replied)}
              </IconLine>
            )}
          </View>

          <View style={styles.forYou}>
            <FactTiles vendor={v} />
            <ForYourEvent vendor={v} fromEvent={event} thumb={cover?.url.small} />
          </View>
        </View>

        {canSuggest && (
          <Button
            icon="bulb-outline"
            label={t('suggestions.button')}
            onPress={() =>
              router.push({
                pathname: '/suggest',
                params: event ? { vendor: v.slug, event } : { vendor: v.slug },
              })
            }
          />
        )}

        {Platform.OS === 'web' && (
          <Button
            variant="text"
            icon="phone-portrait-outline"
            label={t('vendor.openInApp')}
            onPress={() => void Linking.openURL(appLink(`/v/${v.slug}`))}
          />
        )}

        <VendorReels vendorId={v.id} />

        {isVenue && <VisitSection vendorId={v.id} event={event} />}

        {v.price && <PriceSection price={v.price} note={v.priceNote} />}

        <MenusSection vendorId={v.id} />

        <GoodToKnow facts={facts} />

        {allPhotos.length > 0 && <PhotoGrid vendorId={v.id} photos={allPhotos} />}

        <RealWeddings vendorId={v.id} />

        {links.data && (
          <>
            <LinkedVendors
              title={t('vendor.approvedCaterers')}
              vendors={links.data.approvedCaterers}
            />
            <LinkedVendors
              title={t('vendor.approvedAt', { count: links.data.approvedAt.length })}
              vendors={links.data.approvedAt}
            />
            <LinkedVendors title={t('vendor.workedWith')} vendors={links.data.workedWith} />
          </>
        )}

        {(tagline || bio) && (
          <View style={styles.block}>
            <PageHeading>{t('vendor.about')}</PageHeading>
            {tagline && <AppText variant="bodyLg">{tagline}</AppText>}
            {bio && (
              <AppText variant="bodyLg" color="text2">
                {bio}
              </AppText>
            )}
          </View>
        )}

        <ContactList contacts={contacts} />

        <Button
          variant="text"
          label={t('vendor.claim')}
          onPress={() => router.push({ pathname: '/for-vendors', params: { claim: v.slug } })}
        />
      </>
    );
  }

  const v = vendor.data;
  const fromPrice =
    v?.price?.kind === 'starting_at'
      ? v.price.amount
      : v?.price?.kind === 'range'
        ? v.price.from
        : null;
  // "$55 / plate"; a price for the whole event needs no unit
  const fromUnit =
    v?.price && (v.price.kind === 'starting_at' || v.price.kind === 'range') && v.price.unit
      ? v.price.unit
      : null;

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: barHeight + Spacing.xl }}
      >
        {hero}
        <View style={[styles.content, hero ? styles.sheet : { paddingTop: navTop }]}>{body}</View>
      </Animated.ScrollView>

      <NavBar
        scroll={scroll}
        title={v ? localized(v.name) : null}
        trailing={
          v ? (
            <View style={styles.trailing}>
              <GlassButton
                icon="share-outline"
                accessibilityLabel={t('discover.shareLabel', { name: localized(v.name) })}
                onPress={() => {
                  trackVendorActivity(v.id, 'share');
                  void shareVendor(
                    {
                      name: localized(v.name),
                      category: v.categories[0] ? localized(v.categories[0].name) : null,
                      city: v.city,
                      slug: v.slug,
                    },
                    t,
                  );
                }}
                size={44}
              />
              <GlassButton
                icon={saved ? 'heart' : 'heart-outline'}
                color={saved ? Colors.pink : undefined}
                accessibilityLabel={t(saved ? 'vendorCard.unsave' : 'vendorCard.save', {
                  name: localized(v.name),
                })}
                onPress={() => {
                  if (!saved) saveHaptic();
                  const shown = photos.data ?? [];
                  const cover = shown.find((photo) => photo.isCover) ?? shown[0];
                  toggleSave(v.id, event, {
                    name: localized(v.name),
                    photo: cover?.url.medium ?? null,
                  });
                }}
                size={44}
              />
            </View>
          ) : null
        }
      />

      {v && (
        <View
          style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
          onLayout={(layout) => setBarHeight(layout.nativeEvent.layout.height)}
        >
          {fromPrice !== null && (
            <View style={styles.from}>
              <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
                {t('vendor.from').toUpperCase()}
              </AppText>
              <AppText variant="heading" weight={700} numberOfLines={1} style={styles.tabular}>
                {usd.format(fromPrice)}
                {fromUnit && fromUnit !== 'event' ? (
                  <AppText variant="label" color="text2">
                    {` / ${t(`vendorCard.units.${fromUnit}`)}`}
                  </AppText>
                ) : null}
              </AppText>
            </View>
          )}
          <Button
            label={t('vendor.askQuote')}
            accessibilityLabel={t('vendor.askQuoteSpoken', { name: localized(v.name) })}
            onPress={() => void ask()}
            style={fromPrice !== null ? styles.askBeside : styles.askAlone}
          />
        </View>
      )}
      {/* "Saved to Jaago · See list", rising from behind the bottom bar */}
      {v && barHeight > 0 ? <SavedToastHost bottom={barHeight + Spacing.sm} /> : null}
    </View>
  );
}

// How far the page's rounded top rises over the photo
const SHEET_OVERLAP = 28;

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Colors.skeleton,
  },
  heroEmpty: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Spacing.xl + SHEET_OVERLAP,
    backgroundColor: Colors.primaryTint,
  },
  content: {
    gap: Spacing.xxl,
    paddingHorizontal: Sizes.pageGutter + 4,
    paddingTop: Spacing.xl,
  },
  // Over a photo, the page rises over its bottom edge with rounded corners
  sheet: {
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    borderCurve: 'continuous',
    backgroundColor: Colors.bg,
  },
  titleBlock: {
    gap: Spacing.sm,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  caps: {
    letterSpacing: 0.6,
  },
  name: {
    letterSpacing: -0.6,
  },
  founding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  // The name, the numbers, the ticket and Wed's line sit close: the first screen
  top: {
    gap: Spacing.lg,
  },
  forYou: {
    gap: Spacing.lg,
  },
  block: {
    gap: Spacing.md,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  trailing: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    paddingHorizontal: Sizes.pageGutter + 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  from: {
    flex: 1,
  },
  askBeside: {
    paddingHorizontal: Spacing.xl,
  },
  askAlone: {
    flex: 1,
  },
}));
