import { setStringAsync } from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { eventIcon } from '@/components/event-icon';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { SearchField } from '@/components/search-field';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import {
  useGuestLists,
  useGuests,
  useGuestSummary,
  useWeddingRsvpToken,
  weddingRsvpLink,
  type Guest,
  type EventGuestSummary,
} from '@/data/guests';
import { shareInvite } from '@/data/wedding';
import {
  answerLabel,
  guestTotals,
  matchesSearch,
  totalsLine,
} from '@/features/guests/guest-helpers';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * The guest list (#308), from My Wedding: everyone the family is inviting,
 * with the events each is invited to and their answers. People come from the
 * phone's contacts or are typed in; named lists ("Mehndi list") and each
 * event's invites open as sheets. Only the owner and editors see it, since
 * it holds other people's numbers.
 */
export default function GuestsScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const view = usePlanView();
  const { wedding, canEdit, chosen } = view;
  const weddingId = canEdit ? (wedding?.id ?? null) : null;
  const guests = useGuests(weddingId);
  const lists = useGuestLists(weddingId);
  const summary = useGuestSummary(weddingId);
  const weddingLink = weddingRsvpLink(useWeddingRsvpToken(weddingId).data ?? null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const copyLink = async (link: string) => {
    await setStringAsync(link);
    setCopied(true);
  };
  const shareLink = async (link: string) => {
    if ((await shareInvite(link, t, 'guests.weddingLink.shareMessage')) === 'copied') {
      setCopied(true);
    }
  };

  const eventName = (slug: string) => {
    const event = chosen.find((e) => e.slug === slug);
    return event ? localized(event.name) : slug;
  };
  const guestLine = (guest: Guest) =>
    [
      guest.partySize > 1 ? t('guests.people', { count: guest.partySize }) : null,
      ...guest.invites.map(
        (invite) => `${eventName(invite.eventSlug)}: ${answerLabel(invite.rsvp, invite.coming, t)}`,
      ),
      guest.invites.length === 0 ? t('guests.notInvited') : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const eventLine = (counts: EventGuestSummary) =>
    counts.invited === 0
      ? t('guests.noneInvited')
      : [
          t('guests.invitedCount', { count: counts.peopleInvited }),
          t('guests.comingCount', { count: counts.coming }),
          counts.pending > 0 ? t('guests.waitingCount', { count: counts.pending }) : null,
        ]
          .filter(Boolean)
          .join(' · ');

  let body;
  if (!wedding) {
    body = view.loading ? <StateView state="loading" /> : <StartPlanCard />;
  } else if (!canEdit) {
    body = <StateView state="empty" icon="lock-closed-outline" message={t('guests.editorsOnly')} />;
  } else if (guests.isPending) {
    body = <StateView state="loading" />;
  } else if (guests.isError) {
    body = <StateView state="error" onRetry={() => void guests.refetch()} />;
  } else {
    const shown = guests.data.filter((guest) =>
      matchesSearch(query, guest.name, `${guest.phone ?? ''} ${guest.email ?? ''}`),
    );
    body = (
      <>
        <ListSection inset>
          {/* The phone's contacts aren't there on the web */}
          {Platform.OS !== 'web' && (
            <ListRow
              icon="person-add-outline"
              tone="primary"
              title={t('guests.fromContacts')}
              onPress={() => router.push('/guest-contacts')}
            />
          )}
          <ListRow
            icon="create-outline"
            tone="primary"
            title={t('guests.byHand')}
            onPress={() => router.push('/guest')}
          />
        </ListSection>

        <ListSection header={t('guests.details.header')}>
          <ListRow
            icon="time-outline"
            title={t('guests.details.entry')}
            subtitle={wedding.title ?? t('guests.details.entryBody')}
            onPress={() => router.push('/guest-details')}
          />
        </ListSection>

        {guests.data.length === 0 ? (
          <StateView state="empty" icon="people-outline" message={t('guests.empty')} />
        ) : (
          <>
            {/* Only once there are guests: with no one to find, every try counts toward the day's limit */}
            {weddingLink && (
              <ListSection
                header={t('guests.weddingLink.header')}
                footer={copied ? t('share.copied') : t('guests.weddingLink.footer')}
                inset
              >
                <ListRow
                  icon="share-outline"
                  tone="primary"
                  title={t('guests.weddingLink.share')}
                  onPress={() => void shareLink(weddingLink)}
                />
                <ListRow
                  icon="copy-outline"
                  tone="primary"
                  title={t('guests.weddingLink.copy')}
                  onPress={() => void copyLink(weddingLink)}
                />
              </ListSection>
            )}

            <ListSection header={t('guests.eventsHeader')} footer={t('guests.eventsFooter')} inset>
              {chosen.length === 0 ? (
                <ListRow
                  icon="calendar-outline"
                  tone="primary"
                  title={t('guests.pickEvents')}
                  onPress={() => router.push('/plan-events')}
                />
              ) : (
                chosen.map((event) => {
                  const counts = summary.data?.find((s) => s.eventSlug === event.slug);
                  return (
                    <ListRow
                      key={event.slug}
                      icon={eventIcon(event.slug)}
                      title={localized(event.name)}
                      subtitle={counts && eventLine(counts)}
                      onPress={() =>
                        router.push({ pathname: '/guest-invite', params: { event: event.slug } })
                      }
                    />
                  );
                })
              )}
            </ListSection>

            <ListSection header={t('guests.listsHeader')} footer={t('guests.listsFooter')} inset>
              {(lists.data ?? []).map((list) => (
                <ListRow
                  key={list.id}
                  icon="list-outline"
                  title={list.name}
                  // People, like the page's header: a family of 4 is 4, not 1
                  value={t('guests.people', {
                    count: guestTotals(
                      (guests.data ?? []).filter((guest) => list.guestIds.includes(guest.id)),
                    ).people,
                  })}
                  onPress={() => router.push({ pathname: '/guest-list', params: { id: list.id } })}
                />
              ))}
              <ListRow
                icon="add-circle-outline"
                tone="primary"
                title={t('guests.newList')}
                onPress={() => router.push('/guest-list')}
              />
            </ListSection>

            {/* shortcut: every guest renders in the page's scroll view; move to a FlatList if lists pass a few hundred */}
            <View style={styles.block}>
              <SectionTitle>{t('guests.everyone', { count: guests.data.length })}</SectionTitle>
              {guests.data.length > 8 && (
                <SearchField
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('guests.search')}
                />
              )}
              <ListSection>
                {shown.map((guest) => (
                  <ListRow
                    key={guest.id}
                    title={guest.name}
                    subtitle={guestLine(guest)}
                    onPress={() => router.push({ pathname: '/guest', params: { id: guest.id } })}
                  />
                ))}
              </ListSection>
            </View>
          </>
        )}
      </>
    );
  }

  return (
    <NavScreen title={t('guests.title')} subtitle={totalsLine(guests.data ?? [], t)}>
      {body}
    </NavScreen>
  );
}

const useStyles = makeStyles(() => ({
  block: {
    gap: Spacing.md,
  },
}));
