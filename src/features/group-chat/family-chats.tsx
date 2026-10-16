import { router } from 'expo-router';

import { ListRow, ListSection } from '@/components/list';
import { useGroupThreads } from '@/data/group-chat';
import type { AccountWedding } from '@/data/wedding';
import { useLocale } from '@/i18n/locale-context';

import { groupPreview } from './group-format';

/** One line's worth: the list row shows every line of its subtitle. */
function shorten(text: string, max = 70): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * My Wedding's family chats (A2, #125): this wedding's chats I'm in, and, for
 * owners and editors, Start a family chat. Hidden for a suggester in none.
 */
export function FamilyChats({ wedding }: { wedding: AccountWedding }) {
  const { t } = useLocale();
  const threads = useGroupThreads();
  const mine = (threads.data ?? []).filter((thread) => thread.weddingId === wedding.id);
  const canStart = wedding.role === 'owner' || wedding.role === 'editor';
  if (!canStart && mine.length === 0) return null;

  return (
    <ListSection
      header={t('groupChat.title')}
      footer={mine.length === 0 ? t('groupChat.planBody') : undefined}
    >
      {mine.map((thread) => (
        <ListRow
          key={thread.id}
          icon="chatbubbles-outline"
          title={thread.name}
          subtitle={shorten(groupPreview(thread, t))}
          value={thread.unreadCount > 0 ? String(thread.unreadCount) : undefined}
          chevron
          onPress={() => router.push({ pathname: '/group/[id]', params: { id: thread.id } })}
        />
      ))}
      {canStart && (
        <ListRow
          icon="add-circle-outline"
          tone="primary"
          title={t('groupChat.start')}
          onPress={() => router.push({ pathname: '/group-new', params: { wedding: wedding.id } })}
        />
      )}
    </ListSection>
  );
}
