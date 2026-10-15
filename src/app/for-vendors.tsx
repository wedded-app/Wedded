import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useSubmitVendorLead } from '@/data/vendor-leads';
import { useVendor } from '@/data/vendors';
import { normalizePhone } from '@/features/auth/about-you-validation';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

type Field = 'businessName' | 'contactName' | 'city' | 'phone' | 'instagram';

/**
 * S16g For vendors: a free founding listing and a short form. There are no
 * real vendors yet; the founders call these people back and set them up.
 * With ?claim={slug} it becomes "Claim your profile" for that listing.
 * Deep link: /for-vendors.
 */
export default function ForVendorsScreen() {
  const { claim = '' } = useLocalSearchParams<{ claim?: string }>();
  const router = useRouter();
  const { t } = useLocale();
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
      language: 'en',
    });
  }

  if (submit.isSuccess) {
    return (
      <NavScreen>
        <StateView
          state="empty"
          icon="checkmark-circle-outline"
          message={t('forVendors.thanks')}
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

const styles = StyleSheet.create({
  form: {
    gap: Spacing.xl,
  },
});
