import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassButton } from '@/components/glass-button';
import { makeStyles } from '@/constants/theme';
import { useUnreadCount } from '@/data/chat';
import { useLocale } from '@/i18n/locale-context';

/**
 * The chat button at the top right of Home, like Instagram's: opens Messages,
 * with the red count of unread messages. Signed out, Messages explains why to
 * sign in.
 */
export function ChatButton() {
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const unread = useUnreadCount();
  const label =
    unread > 0 ? `${t('chat.title')}, ${t('chat.unread', { count: unread })}` : t('chat.title');

  return (
    <View>
      <GlassButton
        icon="chatbubble-ellipses-outline"
        accessibilityLabel={label}
        onPress={() => router.push('/messages')}
      />
      {unread > 0 && (
        <View style={styles.badge} pointerEvents="none">
          <AppText
            variant="caption"
            weight={700}
            color="onPrimary"
            maxFontSizeMultiplier={1.2}
            style={styles.badgeText}
          >
            {unread > 99 ? '99+' : String(unread)}
          </AppText>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  // The same red count as the tab bar's
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.errorFill,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
}));
