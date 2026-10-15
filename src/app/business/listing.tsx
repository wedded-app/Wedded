import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { type ReactNode, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { Switch } from '@/components/switch';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import {
  type ListingLanguage,
  listingProblem,
  type ContactMethod,
  type PriceDisplay,
  type PriceUnit,
  type ServiceRadius,
  useMyListing,
  useUpdateListing,
} from '@/data/listing';
import {
  BIO_MAX,
  draftChanges,
  type EditableListing,
  LISTING_SECTIONS,
  type ListingDraft,
  type ListingSection,
  listingToDraft,
  TAGLINE_MAX,
} from '@/features/business/listing-draft';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { formatPhone } from '@/lib/phone';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

const PRICE_DISPLAYS: PriceDisplay[] = ['starting_at', 'range', 'packages', 'contact', 'hidden'];
const PRICE_UNITS: PriceUnit[] = ['event', 'person', 'plate', 'hour', 'day', 'hand', 'turban'];
const CONTACTS: ContactMethod[] = ['call', 'text', 'whatsapp', 'instagram', 'email'];
const LANGUAGES: ListingLanguage[] = ['en', 'pa', 'hi', 'ur'];
const RADII: ServiceRadius[] = [10, 25, 50, 100, 250];
const TEAM_WHATSAPP = (process.env.EXPO_PUBLIC_TEAM_WHATSAPP ?? '').replace(/\D/g, '');

/**
 * My business → Edit my listing (C6c): what families read on the page, in
 * plain sections: About you (a tagline and about, each in English and
 * Punjabi), Price, How families reach you, and Languages and travel. Fix it
 * on the page checklist opens it with that section first (`?section=`).
 * Save sends only what changed and says what to fix in plain words, right
 * at the field. Name, address and vendor types stay with the Wedded team.
 */
export default function EditListingScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const current = useCurrentBusiness();
  const listing = useMyListing(current.vendorId);
  const update = useUpdateListing(current.vendorId);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [problem, setProblem] = useState<{ field: string | null; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();

  // Start from the listing once it has loaded
  if (!draft && listing.data) setDraft(listingToDraft(listing.data));

  // Leaving with changes not saved asks first
  const dirty =
    !!draft && !!listing.data && Object.keys(draftChanges(listing.data, draft).changes).length > 0;
  usePreventRemove(dirty && !update.isPending, ({ data }) => {
    const leave = () => navigation.dispatch(data.action);
    if (Platform.OS === 'web') {
      if (globalThis.confirm(t('business.listing.unsavedBody'))) leave();
      return;
    }
    Alert.alert(t('business.listing.unsavedTitle'), t('business.listing.unsavedBody'), [
      { text: t('business.listing.keepEditing'), style: 'cancel' },
      { text: t('business.listing.leave'), style: 'destructive', onPress: leave },
    ]);
  });

  if (!draft || !listing.data) {
    return (
      <NavScreen title={t('business.listing.title')}>
        {current.isPending || listing.isPending ? (
          <StateView state="loading" />
        ) : !current.business ? (
          <StateView state="empty" icon="storefront-outline" message={t('business.notVendor')} />
        ) : (
          <StateView state="error" onRetry={() => void listing.refetch()} />
        )}
      </NavScreen>
    );
  }

  const change = (next: Partial<ListingDraft>) => {
    setDraft({ ...draft, ...next });
    setProblem(null);
    setSaved(false);
  };
  const errorFor = (...fields: (keyof EditableListing)[]) =>
    problem && fields.includes(problem.field as keyof EditableListing)
      ? problem.message
      : undefined;

  const save = () => {
    const result = draftChanges(listing.data, draft);
    if (result.problem) {
      setProblem({
        field: result.problem.field,
        message: t(`business.listing.problems.${result.problem.kind}`),
      });
      return;
    }
    if (Object.keys(result.changes).length === 0) return;
    update.mutate(result.changes, {
      onSuccess: () => {
        successHaptic();
        setSaved(true);
      },
      onError: (error) => {
        const { field, kind } = listingProblem(error);
        setProblem({ field, message: t(`business.listing.serverProblems.${kind}`) });
      },
    });
  };

  // The section Fix it came for goes first
  const first = LISTING_SECTIONS.includes(section as ListingSection)
    ? (section as ListingSection)
    : null;
  const order = first ? [first, ...LISTING_SECTIONS.filter((s) => s !== first)] : LISTING_SECTIONS;
  const blocks: Record<ListingSection, ReactNode> = {
    about: <AboutSection key="about" draft={draft} change={change} errorFor={errorFor} />,
    price: <PriceSection key="price" draft={draft} change={change} errorFor={errorFor} />,
    contact: <ContactSection key="contact" draft={draft} change={change} errorFor={errorFor} />,
    languages: (
      <LanguagesSection key="languages" draft={draft} change={change} errorFor={errorFor} />
    ),
  };

  // Save stays pinned at the bottom once there's something to save (or just saved)
  const showBar = dirty || saved || !!problem;

  return (
    <View style={styles.fill}>
      <NavScreen
        title={t('business.listing.title')}
        subtitle={listing.data.name}
        // The box being typed in stays above the keyboard
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={showBar ? styles.roomForBar : undefined}
      >
        {order.map((s) => blocks[s])}

        <TeamNote name={listing.data.name} />
      </NavScreen>
      {showBar && (
        <View style={styles.bar}>
          {problem && problem.field === null && <FieldError message={problem.message} />}
          {problem && problem.field !== null && (
            <AppText color="error" weight={600}>
              {t('business.listing.fixAbove')}
            </AppText>
          )}
          <Button
            icon={saved && !dirty ? 'checkmark-circle' : undefined}
            label={
              saved && !dirty
                ? t('business.listing.saved')
                : dirty
                  ? t('business.listing.save')
                  : t('business.listing.noChanges')
            }
            loading={update.isPending}
            disabled={!dirty && !saved}
            onPress={save}
          />
          {saved && !dirty && listing.data.status === 'published' && (
            <Button
              variant="secondary"
              icon="storefront-outline"
              label={t('business.viewPage')}
              onPress={() =>
                router.push({ pathname: '/v/[slug]', params: { slug: listing.data.slug } })
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

type SectionProps = {
  draft: ListingDraft;
  change: (next: Partial<ListingDraft>) => void;
  errorFor: (...fields: (keyof EditableListing)[]) => string | undefined;
};

/** A titled white card, the shape each part of the form takes. */
function Part({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.part}>
      <SectionTitle>{title}</SectionTitle>
      {hint && <AppText color="text2">{hint}</AppText>}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/** A label over a row of chips. */
function ChipField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <AppText variant="label" weight={600}>
        {label}
      </AppText>
      <View style={styles.chips}>{children}</View>
      {error && <FieldError message={error} />}
    </View>
  );
}

const count = (text: string, max: number) => `${text.trim().length} / ${max}`;

function AboutSection({ draft, change, errorFor }: SectionProps) {
  const { t } = useLocale();
  return (
    <Part title={t('business.listing.about')} hint={t('business.listing.aboutHint')}>
      <TextField
        label={t('business.listing.tagline')}
        hint={count(draft.tagline, TAGLINE_MAX)}
        value={draft.tagline}
        onChangeText={(tagline) => change({ tagline })}
        error={errorFor('tagline')}
        maxLength={TAGLINE_MAX + 20}
      />
      <TextField
        label={t('business.listing.bio')}
        hint={count(draft.bio, BIO_MAX)}
        value={draft.bio}
        onChangeText={(bio) => change({ bio })}
        error={errorFor('bio')}
        multiline
        maxLength={BIO_MAX + 100}
      />
    </Part>
  );
}

function PriceSection({ draft, change, errorFor }: SectionProps) {
  const { t } = useLocale();
  const priced = draft.priceDisplay === 'starting_at' || draft.priceDisplay === 'range';
  return (
    <Part title={t('business.listing.price')} hint={t('business.listing.priceHint')}>
      <ChipField label={t('business.listing.priceShow')}>
        {PRICE_DISPLAYS.map((display) => (
          <Chip
            key={display}
            role="radio"
            label={t(`business.listing.priceDisplays.${display}`)}
            selected={draft.priceDisplay === display}
            onPress={() => change({ priceDisplay: display })}
          />
        ))}
      </ChipField>
      {priced && (
        <>
          <TextField
            label={
              draft.priceDisplay === 'range'
                ? t('business.listing.priceFromRange')
                : t('business.listing.priceFrom')
            }
            value={draft.priceFrom}
            onChangeText={(priceFrom) => change({ priceFrom })}
            keyboardType="number-pad"
            error={errorFor('priceFrom')}
          />
          {draft.priceDisplay === 'range' && (
            <TextField
              label={t('business.listing.priceTo')}
              value={draft.priceTo}
              onChangeText={(priceTo) => change({ priceTo })}
              keyboardType="number-pad"
              error={errorFor('priceTo')}
            />
          )}
          <ChipField label={t('business.listing.priceUnit')} error={errorFor('priceUnit')}>
            {PRICE_UNITS.map((unit) => (
              <Chip
                key={unit}
                role="radio"
                label={t('business.menus.per', { unit: t(`vendorCard.units.${unit}`) })}
                selected={draft.priceUnit === unit}
                onPress={() => change({ priceUnit: unit })}
              />
            ))}
          </ChipField>
        </>
      )}
      <TextField
        label={t('business.listing.priceNote')}
        hint={t('business.listing.priceNoteHint')}
        value={draft.priceNote}
        onChangeText={(priceNote) => change({ priceNote })}
      />
    </Part>
  );
}

function ContactSection({ draft, change, errorFor }: SectionProps) {
  const { t } = useLocale();
  // Stored numbers show the way people write them; anything typed is kept as typed
  const shown = (value: string) => (/^\+\d+$/.test(value) ? formatPhone(value) : value);
  return (
    <Part title={t('business.listing.contact')} hint={t('business.listing.contactHint')}>
      <TextField
        type="phone"
        label={t('business.listing.callPhone')}
        value={shown(draft.callPhone)}
        onChangeText={(callPhone) => change({ callPhone })}
        error={errorFor('callPhone')}
      />
      <TextField
        type="phone"
        label={t('business.listing.textPhone')}
        value={shown(draft.textPhone)}
        onChangeText={(textPhone) => change({ textPhone })}
        error={errorFor('textPhone')}
      />
      <TextField
        type="phone"
        label={t('business.listing.whatsappPhone')}
        value={shown(draft.whatsappPhone)}
        onChangeText={(whatsappPhone) => change({ whatsappPhone })}
        error={errorFor('whatsappPhone')}
      />
      <ChipField label={t('business.listing.preferred')}>
        {CONTACTS.map((way) => (
          <Chip
            key={way}
            role="radio"
            label={t(`business.listing.ways.${way}`)}
            selected={draft.preferredContact === way}
            onPress={() => change({ preferredContact: way })}
          />
        ))}
      </ChipField>
      <TextField
        label={t('business.listing.instagram')}
        hint={t('business.listing.instagramHint')}
        value={draft.instagramHandle}
        onChangeText={(instagramHandle) => change({ instagramHandle })}
        autoCapitalize="none"
        autoCorrect={false}
        error={errorFor('instagramHandle')}
      />
      <TextField
        label={t('business.listing.website')}
        value={draft.websiteUrl}
        onChangeText={(websiteUrl) => change({ websiteUrl })}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={errorFor('websiteUrl')}
      />
      <TextField
        label={t('business.listing.hours')}
        hint={t('business.listing.hoursHint')}
        value={draft.officeHours}
        onChangeText={(officeHours) => change({ officeHours })}
      />
    </Part>
  );
}

function LanguagesSection({ draft, change, errorFor }: SectionProps) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <Part title={t('business.listing.languagesTravel')}>
      <ChipField label={t('business.listing.languages')} error={errorFor('languages')}>
        {LANGUAGES.map((code) => (
          <Chip
            key={code}
            label={t(`vendor.languages.${code}`)}
            selected={draft.languages.includes(code)}
            onPress={() =>
              change({
                languages: draft.languages.includes(code)
                  ? draft.languages.filter((c) => c !== code)
                  : [...draft.languages, code],
              })
            }
          />
        ))}
      </ChipField>
      {/* Their usual area: shown on the page and used in search */}
      <ChipField label={t('business.listing.radius')}>
        {RADII.map((miles) => (
          <Chip
            key={miles}
            role="radio"
            label={
              miles === 250
                ? t('business.listing.allNorcal')
                : t('business.listing.miles', { miles })
            }
            selected={draft.serviceRadiusMiles === miles}
            onPress={() => change({ serviceRadiusMiles: miles })}
          />
        ))}
      </ChipField>
      {/* Beyond it, usually for a fee: search then finds them anywhere */}
      <View style={styles.switchRow}>
        <AppText weight={600} style={styles.grow}>
          {t('business.listing.willTravel')}
        </AppText>
        <Switch
          value={draft.willTravel}
          onValueChange={(willTravel) => change({ willTravel })}
          accessibilityLabel={t('business.listing.willTravel')}
        />
      </View>
      {draft.willTravel && (
        <>
          <TextField
            label={t('business.listing.travelNote')}
            hint={t('business.listing.travelNoteHint')}
            value={draft.travelNote}
            onChangeText={(travelNote) => change({ travelNote })}
          />
        </>
      )}
      <TextField
        label={t('business.listing.years')}
        value={draft.yearsInBusiness}
        onChangeText={(yearsInBusiness) => change({ yearsInBusiness })}
        keyboardType="number-pad"
        error={errorFor('yearsInBusiness')}
      />
      <TextField
        label={t('business.listing.team')}
        value={draft.teamSize}
        onChangeText={(teamSize) => change({ teamSize })}
        keyboardType="number-pad"
        error={errorFor('teamSize')}
      />
    </Part>
  );
}

/** What only the team changes, and how to ask. */
function TeamNote({ name }: { name: string }) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.note}>
      <AppText color="text2">{t('business.listing.teamNote')}</AppText>
      {TEAM_WHATSAPP ? (
        <Button
          variant="text"
          icon="logo-whatsapp"
          label={t('business.checklist.askTeam')}
          onPress={() =>
            void Linking.openURL(
              `https://wa.me/${TEAM_WHATSAPP}?text=${encodeURIComponent(
                t('business.listing.teamMessage', { name }),
              )}`,
            )
          }
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  part: {
    gap: Spacing.sm,
  },
  card: {
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  field: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 48,
  },
  grow: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  roomForBar: {
    paddingBottom: 160,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  note: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface2,
  },
}));
