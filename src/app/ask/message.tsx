import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { AppText, useTypeStyle } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSendInquiry, type InquiryDraft, type SendOutcome } from '@/data/inquiries';
import { normalizePhone } from '@/features/auth/about-you-validation';
import { useSession } from '@/features/auth/session';
import { askDetails, setAsk } from '@/features/inquiry/ask-draft';
import { AskScreen } from '@/features/inquiry/ask-screen';
import { AskStep } from '@/features/inquiry/ask-step';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useAsk } from '@/features/inquiry/use-ask';
import { WedMark } from '@/features/wed/wed-mark';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

/**
 * Ask for a quote, page 5 of 5: the message Wed wrote from their answers,
 * on a tan card to change any word of, who it's sent as, and Send. How the
 * vendor replies is the vendor's to choose (a call, a text or the chat), so
 * it isn't asked. Send asks people who aren't signed in to sign in, then
 * sends the same message.
 */
export default function AskMessageStep() {
  const ask = useAsk();
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { profile, requireSignIn } = useSession();
  const sending = useSendInquiry();
  const { draft, set, name: vendor } = ask;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [duplicateAt, setDuplicateAt] = useState<string | null>(null);
  // The message grows with its words (a web text box doesn't by itself)
  const [messageHeight, setMessageHeight] = useState(120);
  const { maxFontSizeMultiplier, ...type } = useTypeStyle({ variant: 'body' });

  const name = draft.name ?? profile?.full_name ?? '';
  const phone = draft.phone ?? (profile?.phone ? formatPhone(profile.phone) : '');

  function handle(outcome: SendOutcome, sentAgain: boolean) {
    switch (outcome.kind) {
      case 'sent':
      case 'queued':
        router.replace({
          pathname: '/ask-sent',
          params: {
            vendorId: draft.vendorId,
            event: draft.eventSlugs[0] ?? '',
            queued: outcome.kind === 'queued' ? '1' : '',
          },
        });
        return;
      case 'duplicate':
        setDuplicateAt(outcome.previousAt);
        return;
      case 'needsProfile':
        requireSignIn(() => send(sentAgain));
        return;
      case 'rateLimited':
        setError(
          t(outcome.limit === 'day' ? 'inquiry.errors.tooManyDay' : 'inquiry.errors.tooManyHour'),
        );
        return;
      case 'vendorNotFound':
        setError(t('inquiry.errors.vendorGone'));
        return;
      case 'invalid':
        setError(t('inquiry.errors.invalid'));
        return;
      case 'offline':
        setError(t('inquiry.errors.offline'));
        return;
      default:
        setError(t('inquiry.errors.failed'));
    }
  }

  function send(sendAgain = false) {
    if (!ask.message.trim()) {
      setError(t('inquiry.errors.message'));
      return;
    }
    if (!ask.place.trim()) {
      setError(t('ask.details.whereMissing'));
      return;
    }
    const cleanPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !cleanPhone) {
      setEditing(true);
      setError(t('aboutYou.errors.phoneInvalid'));
      return;
    }
    setError(undefined);
    setDuplicateAt(null);
    const inquiry: InquiryDraft = {
      vendorId: draft.vendorId,
      eventSlugs: draft.eventSlugs,
      eventDate: ask.date,
      guestBand: ask.guestBand,
      location: ask.place.trim(),
      message: ask.message.trim(),
      // The vendor picks how to reply (Fezy, 2026-11-11), but every inquiry
      // still keeps a way; their phone takes a call or a text either way
      preferredContact: 'text',
      name: name.trim() || undefined,
      phone: cleanPhone ?? undefined,
      details: {
        ...askDetails(draft, set),
        // Each event's own day from their plan, so the vendor sees them all
        ...(ask.eventDates.length > 0
          ? { eventDates: Object.fromEntries(ask.eventDates.map((d) => [d.slug, d.date])) }
          : {}),
      },
      sendAgain,
    };
    requireSignIn(() =>
      sending.mutate(inquiry, { onSuccess: (outcome) => handle(outcome, sendAgain) }),
    );
  }

  const sendLabel = t(draft.tour ? 'ask.message.sendVisit' : 'ask.message.send', { vendor });

  return (
    <AskScreen ask={ask}>
      <AskStep
        step={5}
        heading={ask.heading}
        photo={ask.photo}
        title={t('ask.message.title')}
        subtitle={t('ask.message.subtitle')}
        footer={
          <View style={styles.footer}>
            {/* Sending went wrong: said right above Send, never off screen */}
            {error && <FieldError message={error} />}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={sendLabel}
              accessibilityState={{ busy: sending.isPending }}
              disabled={sending.isPending}
              onPress={() => {
                selectionHaptic();
                send(false);
              }}
              style={styles.send}
            >
              {sending.isPending ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <>
                  <AppText variant="button" weight={700} color="onPrimary" numberOfLines={1}>
                    {sendLabel}
                  </AppText>
                  <Icon name="send-outline" size={18} color={Colors.onPrimary} />
                </>
              )}
            </PressableScale>
          </View>
        }
      >
        <View style={styles.card}>
          <View style={styles.kicker}>
            <WedMark size={22} color="ombre" />
            <AppText variant="caption" weight={700} color="primary" style={styles.caps}>
              {t('ask.message.written').toUpperCase()}
            </AppText>
          </View>
          <TextInput
            value={ask.message}
            onChangeText={(text) => setAsk({ ownMessage: text })}
            multiline
            scrollEnabled={false}
            maxLength={2000}
            accessibilityLabel={t('ask.message.label', { vendor })}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            onContentSizeChange={(event) =>
              setMessageHeight(Math.max(120, Math.ceil(event.nativeEvent.contentSize.height)))
            }
            style={[type, styles.message, { color: Colors.text, height: messageHeight }]}
          />
          {draft.ownMessage !== null && (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                selectionHaptic();
                setAsk({ ownMessage: null });
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <AppText variant="label" weight={600} style={styles.underline}>
                {t('ask.message.useWritten')}
              </AppText>
            </Pressable>
          )}
        </View>

        {profile ? (
          <View style={styles.sender}>
            <View style={styles.senderRow}>
              <View style={styles.avatar}>
                <AppText weight={700} color="onPrimary">
                  {(name.trim()[0] ?? '?').toUpperCase()}
                </AppText>
              </View>
              <View style={styles.grow}>
                <AppText weight={700} numberOfLines={1}>
                  {t('ask.message.sendingAs', { name: name.trim() || t('ask.message.you') })}
                </AppText>
                <AppText variant="label" color="text2" numberOfLines={1}>
                  {phone.trim()
                    ? t('ask.message.contact', { phone })
                    : t('ask.message.contactEmail')}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => {
                  selectionHaptic();
                  setEditing((open) => !open);
                }}
                style={({ pressed }) => [styles.change, pressed && styles.pressed]}
              >
                <AppText weight={600} style={styles.underline}>
                  {editing ? t('ask.message.done') : t('ask.message.change')}
                </AppText>
              </Pressable>
            </View>
            {editing && (
              <View style={styles.fields}>
                <TextInput
                  value={name}
                  onChangeText={(text) => setAsk({ name: text })}
                  placeholder={t('ask.message.name')}
                  placeholderTextColor={Colors.textDisabled}
                  accessibilityLabel={t('ask.message.name')}
                  autoComplete="name"
                  textContentType="name"
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  style={[type, styles.line, { color: Colors.text }]}
                />
                <TextInput
                  value={phone}
                  onChangeText={(text) => setAsk({ phone: text })}
                  placeholder={t('ask.message.phone')}
                  placeholderTextColor={Colors.textDisabled}
                  accessibilityLabel={t('ask.message.phone')}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  style={[type, styles.line, { color: Colors.text }]}
                />
              </View>
            )}
          </View>
        ) : (
          <AppText color="text2" style={styles.sender}>
            {t('ask.message.signIn')}
          </AppText>
        )}

        <AppText variant="caption" color="text2">
          {t('ask.message.consent', { vendor })}
        </AppText>

        {duplicateAt && (
          <View style={styles.duplicate}>
            <AppText weight={700}>
              {t('inquiry.alreadyAsked', { vendor, date: formatDate(duplicateAt.slice(0, 10)) })}
            </AppText>
            <PressableScale
              accessibilityRole="button"
              onPress={() => {
                selectionHaptic();
                send(true);
              }}
              style={styles.again}
            >
              <AppText weight={700}>{t('inquiry.sendAgain')}</AppText>
            </PressableScale>
          </View>
        )}
      </AskStep>
    </AskScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  grow: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg + 2,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  caps: {
    letterSpacing: 0.6,
  },
  message: {
    minHeight: 120,
    padding: 0,
    textAlignVertical: 'top',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  sender: {
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  change: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
  },
  fields: {
    gap: Spacing.sm,
  },
  line: {
    minHeight: Sizes.input,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.separator,
  },
  duplicate: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
  },
  again: {
    minHeight: Sizes.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.text,
  },
  footer: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  send: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryFill,
  },
}));
