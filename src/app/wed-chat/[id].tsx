import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { previewConversations } from '@/features/wed/preview-chats';
import { clockTime, useWed } from '@/features/wed/wed-store';

/** Demo conversations stay separate from real UUID-backed vendor chats. */
export default function WedPreviewChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const approvals = useWed((s) => s.approvals);
  const items = useWed((s) => s.items);
  const conversation = previewConversations(approvals, items).find((chat) => chat.id === id);
  const styles = useStyles();
  return (
    <NavScreen
      title={conversation?.name ?? 'Wed preview chat'}
      backTo={{ href: '/messages', label: 'Chats' }}
    >
      <View style={styles.notice}>
        <AppText weight={600}>Wed preview</AppText>
        <AppText color="text2">
          These are demo messages, not real vendor sends. Replay the demo resets these chats.
        </AppText>
      </View>
      {conversation ? (
        conversation.messages.map((message) => (
          <View
            key={message.id}
            style={[styles.message, message.from === 'family' ? styles.mine : styles.theirs]}
          >
            <AppText variant="caption" color="text2">
              {message.from === 'family' ? 'You · via Wed' : conversation.name}
            </AppText>
            <AppText>{message.text}</AppText>
            <AppText variant="caption" color="text2">
              {clockTime(message.at)}
            </AppText>
          </View>
        ))
      ) : (
        <StateView
          state="empty"
          icon="chatbubbles-outline"
          message="This preview chat is no longer available. Approve a new request in Wed to start one."
        />
      )}
    </NavScreen>
  );
}
const useStyles = makeStyles((Colors) => ({
  notice: { gap: Spacing.sm, marginBottom: Spacing.lg },
  message: {
    maxWidth: '92%',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: Radius.card,
    marginBottom: Spacing.md,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: Colors.primaryTint },
  theirs: { alignSelf: 'flex-start', backgroundColor: Colors.surface },
}));
