import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FieldError } from '@/components/field-error';
import { Icon, type IconName } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { type ColorToken, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import {
  REPLY_ANSWERS,
  useAnswerFollowUp,
  useMyInquiries,
  type ReplyAnswer,
} from '@/data/inquiries';
import { useHomeEvents } from '@/data/reference';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

const STATUS_COLOR: Record<string, ColorToken> = {
  sent: 'success',
  sending: 'text2',
  queued: 'kesari',
  failed: 'error',
};

const ANSWER_ICON: Record<ReplyAnswer, IconName> = {
  booked: 'checkmark-circle',
  deciding: 'chatbubble-ellipses-outline',
  no_reply: 'time-outline',
};

/**
 * "Did they get back to you?" (vision §8), two days after an inquiry was
 * sent; once answered, the answer with Change. The answers seed the
 * reliability data; vendors never see them.
 */
function FollowUp({
  inquiryId,
  vendorName,
  answer,
  due,
}: {
  inquiryId: string;
  vendorName: string;
  answer: ReplyAnswer | null;
  due: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const answering = useAnswerFollowUp();
  const [changing, setChanging] = useState(false);

  if (answer && !changing) {
    return (
      <View style={styles.answered}>
        <Icon
          name={ANSWER_ICON[answer]}
          size={Sizes.iconSmall}
          color={answer === 'booked' ? Colors.success : Colors.text2}
        />
        <AppText style={styles.grow}>{t(`myInquiries.followUp.answered.${answer}`)}</AppText>
        <Button
          variant="text"
          label={t('myInquiries.followUp.change')}
          onPress={() => setChanging(true)}
        />
      </View>
    );
  }
  if (!due && !changing) return null;

  return (
    <View style={styles.followUp}>
      <AppText weight={700}>{t('myInquiries.followUp.question', { name: vendorName })}</AppText>
      {REPLY_ANSWERS.map((choice) => (
        <Button
          key={choice}
          variant={choice === answer ? 'primary' : 'secondary'}
          icon={ANSWER_ICON[choice]}
          label={t(`myInquiries.followUp.${choice}`)}
          loading={answering.isPending && answering.variables?.answer === choice}
          onPress={() =>
            answering.mutate({ inquiryId, answer: choice }, { onSuccess: () => setChanging(false) })
          }
        />
      ))}
      {answering.isError && <FieldError message={t('myInquiries.followUp.failed')} />}
      <AppText variant="label" color="text2">
        {t('myInquiries.followUp.hint')}
      </AppText>
    </View>
  );
}

/**
 * My inquiries (vision S16c): newest first, with a status, "Ask again" once
 * 24 hours have passed (or if it didn't send), and "Did they get back to
 * you?" two days after sending.
 */
export default function MyInquiriesScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const inquiries = useMyInquiries();
  const events = useHomeEvents();
  const eventNames = new Map(
    (events.data ?? [])
      .flatMap((section) => section.events)
      .map((event) => [event.slug, event.name]),
  );

  let body;
  if (inquiries.isPending) {
    body = <StateView state="loading" />;
  } else if (inquiries.isError) {
    body = <StateView state="error" onRetry={() => void inquiries.refetch()} />;
  } else if (inquiries.data.length === 0) {
    body = <StateView state="empty" icon="chatbubbles-outline" message={t('myInquiries.empty')} />;
  } else {
    body = (
      <View style={styles.list}>
        {inquiries.data.map((item) => {
          const vendorName = item.vendor ? item.vendor.name : t('saved.noLongerListed');
          const eventsText =
            item.event_slugs.length > 0
              ? item.event_slugs
                  .map((slug) => {
                    const name = eventNames.get(slug);
                    return name ? localized(name) : slug;
                  })
                  .join(', ')
              : t('saved.notSure');
          const canAskAgain = item.vendor && item.canAskAgain;
          return (
            <Card key={item.id} style={styles.card}>
              <View style={styles.row}>
                <AppText variant="bodyLg" weight={700} style={styles.grow}>
                  {vendorName}
                </AppText>
                <View style={styles.status}>
                  <AppText variant="label" color={STATUS_COLOR[item.status] ?? 'text2'}>
                    {t(`myInquiries.status.${item.status}`)}
                  </AppText>
                </View>
              </View>
              <AppText color="text2">
                {[
                  eventsText,
                  item.event_date ? formatDate(item.event_date) : t('inquiry.dateUnsure'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
              <AppText color="text2">
                {t('myInquiries.askedOn', { date: formatDate(item.created_at.slice(0, 10)) })}
              </AppText>
              {item.vendor && (
                <FollowUp
                  inquiryId={item.id}
                  vendorName={vendorName}
                  answer={item.reply_answer as ReplyAnswer | null}
                  due={item.followUpDue}
                />
              )}
              {item.vendor && (
                <View style={styles.actions}>
                  <Button
                    variant="text"
                    label={t('myInquiries.viewVendor')}
                    onPress={() => router.push(`/v/${item.vendor?.slug}` as Href)}
                  />
                  {canAskAgain && (
                    <Button
                      variant="text"
                      icon="refresh-outline"
                      label={t('myInquiries.askAgain')}
                      onPress={() =>
                        router.push({
                          pathname: '/ask',
                          params: { vendorId: item.vendor_id, event: item.event_slugs[0] ?? '' },
                        })
                      }
                    />
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </View>
    );
  }

  return (
    <NavScreen
      title={t('myInquiries.title')}
      refreshControl={
        <RefreshControl
          refreshing={inquiries.isRefetching}
          onRefresh={() => void inquiries.refetch()}
          tintColor={Colors.chevron}
          colors={[Colors.primary]}
        />
      }
    >
      {body}
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: {
    gap: Spacing.lg,
  },
  card: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
  status: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.chip,
    backgroundColor: Colors.bg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  followUp: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.bg,
  },
  answered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
}));
