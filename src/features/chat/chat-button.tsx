import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, useColors } from '@/constants/theme';
import { useUnreadCount } from '@/data/chat';
import { useLocale } from '@/i18n/locale-context';

/**
 * The chat button at the top right of Home, like Instagram's: opens Messages,
 * with the red count of unread messages. Signed out, Messages explains why to
 * sign in. A solid circle rather than glass, so it reads over any cover photo.
 */
export function ChatButton() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const unread = useUnreadCount();
  const label =
    unread > 0 ? `${t('chat.title')}, ${t('chat.unread', { count: unread })}` : t('chat.title');

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => router.push('/messages')}
        hitSlop={4}
        style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
      >
        <Icon
          name="chatbubble-ellipses-outline"
          size={24}
          color={Colors.primary}
          weight="semibold"
        />
      </Pressable>
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
  circle: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
  pressed: {
    opacity: 0.7,
  },
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
