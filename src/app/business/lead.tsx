import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { type Lead, useBusinessLeads } from '@/data/business';
import { leadAnswerRows } from '@/features/business/business-format';
import { useEventNames } from '@/features/business/business-parts';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { formatTime } from '@/features/vendors/profile-format';
import { useLocale } from '@/i18n/locale-context';
import { formatPhone } from '@/lib/phone';

/**
 * One family's request (`?id=`): what they asked for, their message and
 * answers, and the ways to reply. Replying in the app comes first; Call,
 * Text and WhatsApp use the number they sent with the request.
 */
export default function BusinessLeadScreen() {
  const { t } = useLocale();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const current = useCurrentBusiness();
  const leads = useBusinessLeads(current.vendorId);
  const lead = leads.data?.find((l) => l.id === id);

  if (!lead) {
    return (
      <NavScreen title={t('business.leads.one')}>
        {current.isPending || leads.isPending ? (
          <StateView state="loading" />
        ) : leads.isError ? (
          <StateView state="error" onRetry={() => void leads.refetch()} />
        ) : (
          <StateView state="empty" icon="people-outline" message={t('business.leads.notFound')} />
        )}
      </NavScreen>
    );
  }
  return <LeadDetails lead={lead} />;
}

function LeadDetails({ lead }: { lead: Lead }) {
  const styles = useStyles();
  const { t } = useLocale();
  const eventName = useEventNames();
  const who = lead.familyName ?? t('chat.aFamily');
  const answers = leadAnswerRows(lead.details, t);
  const date = lead.eventDate
    ? [formatDate(lead.eventDate), lead.startTime ? formatTime(lead.startTime.slice(0, 5)) : null]
        .filter(Boolean)
        .join(', ')
    : t('business.leads.dateNotSure');
  const digits = lead.phone?.replace(/\D/g, '') ?? '';

  return (
    <NavScreen
      title={who}
      subtitle={t(lead.kind === 'tour' ? 'business.leads.askedTour' : 'business.leads.asked', {
        date: formatDate(lead.createdAt.slice(0, 10)),
      })}
    >
      <ListSection>
        {lead.eventSlugs.length > 0 && (
          <ListRow
            title={t('business.leads.events')}
            subtitle={lead.eventSlugs.map(eventName).join(', ')}
          />
        )}
        <ListRow title={t('business.leads.date')} subtitle={date} />
        <ListRow
          title={t('business.leads.guestsTitle')}
          subtitle={t(`inquiry.guestBands.${lead.guestBand}`)}
        />
        {lead.location ? (
          <ListRow title={t('business.leads.where')} subtitle={lead.location} />
        ) : null}
        <ListRow
          title={t('business.leads.replyBy')}
          subtitle={t(`inquiry.replyWays.${lead.preferredContact}`)}
        />
      </ListSection>

      {lead.message ? (
        <View style={styles.block}>
          <SectionTitle>{t('business.leads.message')}</SectionTitle>
          <View style={styles.message}>
            <AppText variant="bodyLg" selectable>
              {lead.message}
            </AppText>
          </View>
        </View>
      ) : null}

      {answers.length > 0 && (
        <ListSection header={t('business.leads.answers')}>
          {answers.map((row) => (
            <ListRow key={row.label} title={row.label} subtitle={row.value} />
          ))}
        </ListSection>
      )}

      <View style={styles.block}>
        <SectionTitle>{t('business.leads.reply')}</SectionTitle>
        {lead.replied && (
          <AppText color="success" weight={600}>
            {t('business.leads.youReplied')}
          </AppText>
        )}
        {lead.conversationId && (
          <Button
            icon="chatbubbles-outline"
            label={t('business.leads.openChat')}
            onPress={() =>
              router.push({ pathname: '/chat/[id]', params: { id: lead.conversationId ?? '' } })
            }
          />
        )}
        {lead.phone && (
          <>
            <AppText variant="heading" weight={700} selectable>
              {formatPhone(lead.phone)}
            </AppText>
            <View style={styles.row}>
              <Button
                variant="secondary"
                icon="call-outline"
                label={t('business.leads.call')}
                onPress={() => void Linking.openURL(`tel:${lead.phone}`)}
                style={styles.grow}
              />
              <Button
                variant="secondary"
                icon="chatbubble-outline"
                label={t('business.leads.text')}
                onPress={() => void Linking.openURL(`sms:${lead.phone}`)}
                style={styles.grow}
              />
            </View>
            <Button
              variant="secondary"
              icon="logo-whatsapp"
              label={t('business.leads.whatsapp')}
              onPress={() => void Linking.openURL(`https://wa.me/${digits}`)}
            />
          </>
        )}
        {lead.email && (
          <Button
            variant="secondary"
            icon="mail-outline"
            label={t('business.leads.email')}
            onPress={() => void Linking.openURL(`mailto:${lead.email}`)}
          />
        )}
        {!lead.conversationId && !lead.phone && !lead.email && (
          <AppText color="text2">{t('business.leads.noWay')}</AppText>
        )}
      </View>
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  message: {
    padding: Spacing.lg,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  grow: {
    flexGrow: 1,
    minWidth: 140,
  },
}));
