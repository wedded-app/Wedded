import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { makeStyles, Radius, Spacing } from '@/constants/theme';

import type { PreviewConversation } from './preview-chats';
import { clockTime } from './wed-store';

export function PreviewInbox({ conversations }: { conversations: PreviewConversation[] }) {
  const styles = useStyles();
  if (!conversations.length) return null;
  return (
    <View style={styles.section}>
      <AppText weight={600}>Wed preview chats</AppText>
      <AppText variant="caption" color="text2">
        Demo messages only. These have not been sent to vendors.
      </AppText>
      <View style={styles.group}>
        {conversations.map((conversation, index) => (
          <Pressable
            key={conversation.id}
            accessibilityRole="button"
            accessibilityLabel={`Open preview chat with ${conversation.name}`}
            onPress={() =>
              router.push({ pathname: '/wed-chat/[id]', params: { id: conversation.id } })
            }
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.divided,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.top}>
              <AppText weight={600} numberOfLines={1} style={styles.name}>
                {conversation.name}
              </AppText>
              <AppText variant="caption" color="text2">
                {clockTime(conversation.updatedAt)}
              </AppText>
            </View>
            <AppText color="text2" numberOfLines={2}>
              {conversation.messages.at(-1)?.text}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const useStyles = makeStyles((Colors) => ({
  section: { gap: Spacing.sm, marginBottom: Spacing.xl },
  group: { borderRadius: Radius.card, backgroundColor: Colors.surface, overflow: 'hidden' },
  row: { minHeight: 84, padding: Spacing.lg, gap: Spacing.xs },
  divided: { borderTopWidth: 1, borderTopColor: Colors.separator },
  pressed: { backgroundColor: Colors.rowPressed },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flex: 1 },
}));
