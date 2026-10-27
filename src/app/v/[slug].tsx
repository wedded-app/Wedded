import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
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

import { ActionButton } from '@/components/action-button';
import { AppText, useFontScale } from '@/components/app-text';
import { SampleTag } from '@/components/sample-tag';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Glass } from '@/components/glass';
import { GlassButton } from '@/components/glass-button';
import { groupIcon } from '@/components/group-icon';
import { Icon, type IconName } from '@/components/icon';
import { IconLine } from '@/components/icon-line';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavBar, useNavScroll, useNavTop } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { appLink } from '@/constants/links';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSavedEventsFor, useSaveVendor } from '@/data/saved';
import { useVendorLinks } from '@/data/vendor-links';
import { useVendorPhotos } from '@/data/vendor-media';
import { useVendor } from '@/data/vendors';
import { useMyBusinesses } from '@/data/business';
import { useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import { chooseBusiness } from '@/features/business/use-current-business';
import { SavedToastHost } from '@/features/saved/saved-toast';
import { trackVendorActivity, useVendorPublicStats } from '@/data/vendor-stats';
import { useStartConversation } from '@/data/chat';
import { DateTicket } from '@/features/vendors/date-ticket';
import { FactTiles } from '@/features/vendors/fact-tiles';
import {
  ContactList,
  GoodToKnow,
  Highlights,
  LinkedVendors,
  MenusSection,
  PhotoGrid,
  PriceSection,
  RealWeddings,
  type ContactLine,
} from '@/features/vendors/profile-sections';
import { ALL_NORCAL_MILES, factLabels } from '@/features/vendors/profile-format';
import { shareVendor } from '@/features/vendors/share';
import { openWed } from '@/features/wed/open-wed';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { saveHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

// The contact buttons in one row: the rest are printed under Contact
const MAX_ACTIONS = 4;
/**
 * S9 Vendor profile. Deep link: /v/{slug}. Opens over the tabs. The cover
 * photo runs edge to edge under the status bar with the glass Back button
 * floating on it; Save and Ask float in a glass bar at the bottom.
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
  const mine = useMyBusinesses().businesses.find((b) => b.slug === slug);
  const navTop = useNavTop();
  const reduceMotion = useReducedMotion();
  // Side by side, a Punjabi "Save" breaks mid-word at very large text sizes.
  const stackButtons = useFontScale('button') >= 1.5;
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
  const links = useVendorLinks(vendor.data?.id ?? '');
  const photos = useVendorPhotos(vendor.data?.id ?? '');
  const { toggleSave } = useSaveVendor();
  const saved = useSavedEventsFor(vendor.data?.id ?? '').length > 0;

  // The cover is about a phone's width tall, a little less on wide screens.
  const heroHeight = Math.round(Math.min(width, 480) * 0.82);

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
  // The name's position is measured below the cover, so add the cover back.
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

  let hero = null;
  let body;
  if (vendor.isPending) {
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
    const facts = factLabels(v.facts, t);
    // Halls, gurdwaras and other venues take visits before booking (demo step 3).
    const isVenue = v.categories.some((category) => category.groupSlug === 'venues');
    const allPhotos = photos.data ?? [];
    const cover = allPhotos.find((photo) => photo.isCover) ?? allPhotos[0];
    const languages = v.languages.map((name) => localized(name)).join(', ');
    const categoryNames = v.categories.map((category) => localized(category.name));

    const actions: {
      key: string;
      icon: IconName;
      label: string;
      spoken: string;
      onPress: () => void;
    }[] = [];
    // In-app chat first: no phone number to copy, and the inquiry is already in it.
    actions.push({
      key: 'message',
      icon: 'chatbubbles-outline',
      label: t('chat.message'),
      spoken: t('chat.messageSpoken', { name }),
      onPress: () =>
        requireSignIn(() =>
          startChat.mutate(v.id, {
            onSuccess: (conversationId) =>
              router.push({ pathname: '/chat/[id]', params: { id: conversationId } }),
            onError: () => notify(t('chat.startFailed')),
          }),
        ),
    });
    if (v.callPhone) {
      const phone = v.callPhone;
      actions.push({
        key: 'call',
        icon: 'call',
        label: t('vendor.call'),
        spoken: t('vendor.callSpoken', { name, phone: formatPhone(phone) }),
        // A confirm sheet showing the number prevents pocket calls (vision S9).
        // On the web the phone asks before a tel: link calls, and Alert does
        // nothing there, so the link opens straight away.
        onPress: () =>
          Platform.OS === 'web'
            ? (trackVendorActivity(v.id, 'call'), open(`tel:${phone}`))
            : Alert.alert(t('vendor.callTitle', { name }), formatPhone(phone), [
                { text: t('vendor.cancel'), style: 'cancel' },
                {
                  text: t('vendor.call'),
                  onPress: () => {
                    trackVendorActivity(v.id, 'call');
                    open(`tel:${phone}`);
                  },
                },
              ]),
      });
    }
    // Wed (mockup): the composer starts with this vendor and a date question
    actions.push({
      key: 'wed',
      icon: 'sparkles-outline',
      label: 'Ask Wed',
      spoken: `Ask Wed about ${v.name.en}`,
      onPress: () =>
        openWed({
          about: { kind: 'vendor', id: v.slug, label: v.name.en, thumb: cover?.url.small },
          ask: `Is ${v.name.en} free on Jun 13, and what do they charge?`,
        }),
    });
    if (v.whatsappPhone) {
      actions.push({
        key: 'whatsapp',
        icon: 'logo-whatsapp',
        label: t('vendor.whatsapp'),
        spoken: t('vendor.whatsappSpoken', { name }),
        onPress: () => {
          trackVendorActivity(v.id, 'whatsapp');
          open(`https://wa.me/${v.whatsappPhone?.replace(/\D/g, '')}`);
        },
      });
    }
    if (v.textPhone) {
      actions.push({
        key: 'text',
        icon: 'chatbubble-outline',
        label: t('vendor.text'),
        spoken: t('vendor.textSpoken', { name, phone: formatPhone(v.textPhone) }),
        onPress: () => {
          trackVendorActivity(v.id, 'text');
          open(`sms:${v.textPhone}`);
        },
      });
    }
    if (v.instagramHandle) {
      actions.push({
        key: 'instagram',
        icon: 'logo-instagram',
        label: t('vendor.instagram'),
        spoken: t('vendor.instagramSpoken', { name }),
        onPress: () => {
          trackVendorActivity(v.id, 'instagram');
          open(`https://instagram.com/${v.instagramHandle}`);
        },
      });
    }
    // Directions open from the address row below, not one more button
    const directions = v.addressLine
      ? () => {
          const destination = encodeURIComponent(v.addressLine ?? '');
          trackVendorActivity(v.id, 'directions');
          open(
            Platform.OS === 'ios'
              ? `https://maps.apple.com/?daddr=${destination}`
              : `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
          );
        }
      : undefined;

    // Each line also does what its button would, for the ones that don't fit the row
    const doAction = (key: string) => actions.find((action) => action.key === key)?.onPress;
    const contacts: ContactLine[] = [];
    if (v.callPhone) {
      contacts.push({
        label: t('vendor.phone'),
        value: formatPhone(v.callPhone),
        onPress: doAction('call'),
      });
    }
    if (v.textPhone && v.textPhone !== v.callPhone) {
      contacts.push({
        label: t('vendor.text'),
        value: formatPhone(v.textPhone),
        onPress: doAction('text'),
      });
    }
    if (v.whatsappPhone) {
      contacts.push({
        label: t('vendor.whatsapp'),
        value: formatPhone(v.whatsappPhone),
        onPress: doAction('whatsapp'),
      });
    }
    if (v.instagramHandle) {
      contacts.push({
        label: t('vendor.instagram'),
        value: `@${v.instagramHandle}`,
        onPress: doAction('instagram'),
      });
    }
    if (v.websiteUrl) {
      const site = v.websiteUrl;
      contacts.push({
        label: t('vendor.website'),
        value: site,
        onPress: () => open(/^https?:\/\//.test(site) ? site : `https://${site}`),
      });
    }

    const category = categoryNames[0] ?? null;
    // Without photos, a shorter band with the category's icon.
    const heroBand = cover ? heroHeight : Math.round(heroHeight * 0.7);

    hero = cover ? (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={t('gallery.open', { number: 1, total: allPhotos.length })}
        onPress={() =>
          router.push({
            pathname: '/gallery',
            params: { vendorId: v.id, index: String(allPhotos.indexOf(cover)) },
          })
        }
        style={[styles.hero, { height: heroHeight }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
          <Image
            source={{ uri: cover.url.medium }}
            placeholder={cover.blurhash ? { blurhash: cover.blurhash } : undefined}
            contentFit="cover"
            transition={250}
            accessible={false}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {allPhotos.length > 1 && (
          <Glass style={styles.photoCount}>
            <Icon name="image-outline" size={16} color={Colors.text} />
            <AppText variant="caption" weight={600} style={styles.tabular}>
              {String(allPhotos.length)}
            </AppText>
          </Glass>
        )}
      </Pressable>
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

        <View style={styles.titleBlock} onLayout={(layout) => onTitleLayout(layout, heroBand)}>
          {v.foundingNumber != null && (
            <View style={styles.founding}>
              <Icon name="ribbon-outline" size={17} color={Colors.kesari} weight="semibold" />
              <AppText variant="label" weight={600} color="kesari">
                {t('vendor.foundingNumber', { number: v.foundingNumber })}
              </AppText>
            </View>
          )}
          <AppText variant="title" accessibilityRole="header">
            {name}
          </AppText>
          <SampleTag show={v.isSample} />
          <AppText color="text2">{[categoryNames.join(', '), v.city].join(' · ')}</AppText>
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

        <DateTicket
          vendorId={v.id}
          categorySlugs={v.categories.map((c) => c.slug)}
          fromEvent={event}
        />

        <FactTiles vendor={v} />

        {tagline && <AppText variant="bodyLg">{tagline}</AppText>}

        {allPhotos.length > 0 && <Highlights slug={v.slug} photos={allPhotos} name={name} />}

        {Platform.OS === 'web' && (
          <Button
            variant="text"
            icon="phone-portrait-outline"
            label={t('vendor.openInApp')}
            onPress={() => void Linking.openURL(appLink(`/v/${v.slug}`))}
          />
        )}

        {/* Four at most, so the row stays one calm line; the rest are in Contact below */}
        {actions.length > 0 && (
          <View style={styles.actions}>
            {actions.slice(0, MAX_ACTIONS).map((action) => (
              <ActionButton
                key={action.key}
                icon={action.icon}
                label={action.label}
                accessibilityLabel={action.spoken}
                onPress={action.onPress}
              />
            ))}
          </View>
        )}

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

        {isVenue && (
          <Button
            variant="secondary"
            icon="calendar-outline"
            label={t('vendor.bookTour')}
            onPress={() =>
              router.push({
                pathname: '/ask',
                params: event
                  ? { vendorId: v.id, event, kind: 'tour' }
                  : { vendorId: v.id, kind: 'tour' },
              })
            }
          />
        )}

        <ListSection inset>
          <ListRow
            icon="location-outline"
            title={v.addressLine ?? t('vendor.basedIn', { city: v.city })}
            onPress={directions}
            accessibilityLabel={
              directions ? `${v.addressLine}. ${t('vendor.directionsSpoken', { name })}` : undefined
            }
          />
          {!v.addressLine && (
            <ListRow
              icon="car-outline"
              title={
                (v.serviceRadiusMiles >= ALL_NORCAL_MILES
                  ? t('vendor.travelsNorcal')
                  : t('vendor.travelsUpTo', { miles: v.serviceRadiusMiles })) +
                (v.willTravel && v.travelNote ? ` ${v.travelNote}` : '')
              }
            />
          )}
          {languages.length > 0 && (
            <ListRow icon="language-outline" title={t('vendor.speaks', { languages })} />
          )}
        </ListSection>

        {v.price && <PriceSection price={v.price} note={v.priceNote} />}

        <MenusSection vendorId={v.id} />

        <GoodToKnow facts={facts} />

        {allPhotos.length > 0 && (
          <View style={styles.block}>
            <SectionTitle>{t('vendor.photos')}</SectionTitle>
            <PhotoGrid vendorId={v.id} photos={allPhotos} />
          </View>
        )}

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

        {bio && (
          <View style={styles.block}>
            <SectionTitle>{t('vendor.about')}</SectionTitle>
            <Card>
              <AppText variant="bodyLg">{bio}</AppText>
            </Card>
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

  const barBottom = Math.max(insets.bottom - 8, Spacing.md);

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: barHeight + barBottom + Spacing.xl }}
      >
        {hero}
        <View style={[styles.content, hero ? styles.sheet : { paddingTop: navTop }]}>{body}</View>
      </Animated.ScrollView>

      <NavBar
        scroll={scroll}
        title={vendor.data ? localized(vendor.data.name) : null}
        trailing={
          vendor.data ? (
            <GlassButton
              icon="share-outline"
              accessibilityLabel={t('discover.shareLabel', {
                name: localized(vendor.data.name),
              })}
              onPress={() => {
                const v = vendor.data;
                if (!v) return;
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
          ) : null
        }
      />

      {vendor.data && (
        <View
          style={[styles.barWrap, { bottom: barBottom }]}
          onLayout={(layout) => setBarHeight(layout.nativeEvent.layout.height)}
        >
          <Glass style={[styles.bar, stackButtons && styles.barStacked]}>
            <Button
              variant="secondary"
              icon={saved ? 'heart' : 'heart-outline'}
              label={saved ? t('vendor.saved') : t('vendor.save')}
              accessibilityLabel={t(saved ? 'vendorCard.unsave' : 'vendorCard.save', {
                name: localized(vendor.data.name),
              })}
              onPress={() => {
                if (!vendor.data) return;
                if (!saved) saveHaptic();
                toggleSave(vendor.data.id, event);
              }}
              style={[styles.barButton, !stackButtons && styles.save]}
            />
            <Button
              label={t('vendor.ask')}
              onPress={() =>
                vendor.data &&
                router.push({
                  pathname: '/ask',
                  params: event
                    ? { vendorId: vendor.data.id, event }
                    : { vendorId: vendor.data.id },
                })
              }
              style={[styles.barButton, !stackButtons && styles.ask]}
            />
          </Glass>
        </View>
      )}
      {/* "Saved to Jaago · See list", rising from behind the Save bar */}
      {vendor.data && barHeight > 0 ? <SavedToastHost bottom={barBottom + barHeight} /> : null}
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
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.primaryTint,
  },
  photoCount: {
    position: 'absolute',
    right: Spacing.lg,
    // Clear of the sheet's rounded top
    bottom: SHEET_OVERLAP + Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.chip,
  },
  content: {
    gap: Spacing.xl,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.xl,
  },
  // Over a photo, the page rises over its bottom edge with rounded corners
  sheet: {
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderCurve: 'continuous',
    backgroundColor: Colors.bg,
  },
  titleBlock: {
    gap: Spacing.xs,
  },
  founding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  block: {
    gap: Spacing.lg,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  barWrap: {
    position: 'absolute',
    left: Sizes.tabBarInset,
    right: Sizes.tabBarInset,
  },
  bar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: (Sizes.button + Spacing.sm * 2) / 2,
  },
  barStacked: {
    flexDirection: 'column',
    borderRadius: Radius.card + Spacing.sm,
  },
  barButton: {
    paddingHorizontal: Spacing.md,
  },
  // Save 40 percent, Ask 60 percent (vision doc S9).
  save: {
    flex: 2,
  },
  ask: {
    flex: 3,
  },
}));
