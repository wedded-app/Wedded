import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { useSubmitVendorLead } from '@/data/vendor-leads';
import { useVendor } from '@/data/vendors';
import { normalizePhone } from '@/features/auth/about-you-validation';
import { maskedPhone } from '@/features/vendors/claim-checks';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

type Field = 'businessName' | 'contactName' | 'city' | 'phone' | 'instagram' | 'proof';
type Proof = 'email' | 'instagram' | 'license';
const PROOFS: Proof[] = ['email', 'instagram', 'license'];

/**
 * S16g For vendors: a free founding listing and a short form. There are no
 * real vendors yet; the founders call these people back and set them up.
 * With ?claim={slug} it becomes "Claim your profile" for that listing, with
 * the two checks spelled out first (the final look, 2026-10-23): a code to
 * the business phone on the listing, then one more proof they pick (their
 * business email, a code in their Instagram bio, or a photo of their
 * license), and a person reviews every claim. The pick goes to the founders
 * in the lead's note. Deep link: /for-vendors.
 */
export default function ForVendorsScreen() {
  const { claim = '' } = useLocalSearchParams<{ claim?: string }>();
  const router = useRouter();
  const styles = useStyles();
  const { t } = useLocale();
  const [proof, setProof] = useState<Proof | null>(null);
  const claimed = useVendor(claim);
  const submit = useSubmitVendorLead();
  const [attempted, setAttempted] = useState(false);
  const [draft, setDraft] = useState({
    businessName: '',
    contactName: '',
    category: '',
    city: '',
    phone: '',
    instagram: '',
  });

  const isClaim = claim.length > 0;
  const businessName = draft.businessName || (claimed.data ? localized(claimed.data.name) : '');
  const phone = normalizePhone(draft.phone);
  const instagram = draft.instagram.trim().replace(/^@/, '');

  const errors: Partial<Record<Field, string>> = {};
  if (!businessName.trim()) errors.businessName = t('forVendors.errors.businessName');
  if (!draft.contactName.trim()) errors.contactName = t('forVendors.errors.contactName');
  if (!draft.city.trim()) errors.city = t('forVendors.errors.city');
  if (!phone) errors.phone = t('forVendors.errors.phone');
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    errors.instagram = t('forVendors.errors.instagram');
  }
  if (isClaim && !proof) errors.proof = t('forVendors.checks.pickOne');
  const listingPhone = maskedPhone(claimed.data?.callPhone ?? claimed.data?.textPhone ?? null);
  const shown = attempted ? errors : {};

  const set = (field: keyof typeof draft) => (text: string) =>
    setDraft((current) => ({ ...current, [field]: text }));

  function send() {
    setAttempted(true);
    if (Object.keys(errors).length > 0 || !phone) return;
    submit.mutate({
      businessName: businessName.trim(),
      contactName: draft.contactName.trim(),
      category: draft.category.trim() || undefined,
      city: draft.city.trim(),
      phone,
      instagramHandle: instagram || undefined,
      claimedVendorId: isClaim ? claimed.data?.id : undefined,
      // In English for the founders, whatever the app's words
      note: isClaim && proof ? `Second check: ${proof}` : undefined,
    });
  }

  if (submit.isSuccess) {
    return (
      <NavScreen>
        <StateView
          state="empty"
          icon="checkmark-circle-outline"
          message={isClaim ? t('forVendors.checks.thanks') : t('forVendors.thanks')}
          action={{ label: t('common.goHome'), onPress: () => router.navigate('/') }}
        />
      </NavScreen>
    );
  }

  return (
    <NavScreen
      title={isClaim ? t('forVendors.claimTitle') : t('forVendors.title')}
      subtitle={isClaim ? t('forVendors.claimIntro') : t('forVendors.intro')}
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.form}>
        {isClaim && (
          <View style={styles.checks}>
            <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
              {t('forVendors.checks.caps').toUpperCase()}
            </AppText>
            <Step number={1} title={t('forVendors.checks.codeTitle')}>
              {listingPhone
                ? t('forVendors.checks.codeBody', { phone: listingPhone })
                : t('forVendors.checks.codeBodyNoPhone')}
            </Step>
            <Step number={2} title={t('forVendors.checks.proofTitle')}>
              {t('forVendors.checks.proofBody')}
            </Step>
            <View
              style={styles.proofs}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('forVendors.checks.proofTitle')}
            >
              {PROOFS.map((option) => (
                <Chip
                  key={option}
                  role="radio"
                  tone="ink"
                  label={t(`forVendors.checks.proofs.${option}`)}
                  selected={proof === option}
                  onPress={() => setProof(option)}
                />
              ))}
            </View>
            {shown.proof && <FieldError message={shown.proof} />}
            <Step number={3} title={t('forVendors.checks.reviewTitle')}>
              {t('forVendors.checks.reviewBody')}
            </Step>
          </View>
        )}
        <TextField
          label={t('forVendors.businessName')}
          value={businessName}
          onChangeText={set('businessName')}
          error={shown.businessName}
          maxLength={80}
        />
        <TextField
          type="name"
          label={t('forVendors.contactName')}
          value={draft.contactName}
          onChangeText={set('contactName')}
          error={shown.contactName}
          maxLength={80}
        />
        {!isClaim && (
          <TextField
            label={t('forVendors.category')}
            hint={t('forVendors.categoryHint')}
            value={draft.category}
            onChangeText={set('category')}
            maxLength={80}
          />
        )}
        <TextField
          type="city"
          label={t('forVendors.city')}
          value={draft.city}
          onChangeText={set('city')}
          error={shown.city}
          maxLength={60}
        />
        <TextField
          type="phone"
          label={t('forVendors.phone')}
          hint={t('forVendors.phoneHint')}
          value={draft.phone}
          onChangeText={set('phone')}
          error={shown.phone}
          maxLength={20}
        />
        <TextField
          label={t('forVendors.instagram')}
          value={draft.instagram}
          onChangeText={set('instagram')}
          error={shown.instagram}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={31}
        />

        {attempted && Object.keys(errors).length > 0 && (
          <FieldError message={t('aboutYou.fixErrors')} />
        )}
        {submit.isError && <FieldError message={t('forVendors.sendFailed')} />}
        <Button label={t('forVendors.send')} loading={submit.isPending} onPress={send} />
      </View>
    </NavScreen>
  );
}

/** One numbered check in the claim's explanation. */
function Step({ number, title, children }: { number: number; title: string; children: string }) {
  const styles = useStyles();
  return (
    <View style={styles.step}>
      <View style={styles.number}>
        <AppText variant="label" weight={700} color="onPrimary">
          {String(number)}
        </AppText>
      </View>
      <View style={styles.stepWords}>
        <AppText weight={600}>{title}</AppText>
        <AppText variant="label" color="text2">
          {children}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  form: {
    gap: Spacing.xl,
  },
  checks: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  caps: {
    letterSpacing: 0.6,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  stepWords: {
    flex: 1,
    gap: 2,
  },
  proofs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingLeft: 28 + Spacing.md,
  },
}));
