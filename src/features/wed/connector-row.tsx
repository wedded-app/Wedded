import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow } from '@/components/list';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';

import { appMeta, type AppId } from './mock';
import { appValue, useWed, wed } from './wed-store';

/**
 * One app Wed can use, as a row on the Apps page: a plain outlined icon
 * (never the brand's art), its name, what Wed can do with it, and where it
 * stands when that says more than its section does ("Off", "Connected",
 * "Preview"; never "Always on" under Always on). The phone
 * calendar and Gmail open /wed-connect to connect (Gmail as a preview); a
 * connected one opens it to disconnect. Other coming-soon apps can't be
 * opened yet: they offer "Tell me when it's ready", which turns into "We'll
 * tell you" (tap again to take it back). Built-in ones are just facts.
 */
export function ConnectorRow({ app }: { app: AppId }) {
  const meta = appMeta(app);
  const state = useWed((s) => s.apps[app]);
  const opens = app === 'calendar' || app === 'gmail';

  if (state.status === 'soon' && !opens) return <SoonRow app={app} />;
  // The section header already says Always on or Coming soon
  const value = state.status === 'builtIn' || state.status === 'soon' ? undefined : appValue(state);

  return (
    <ListRow
      icon={meta.icon}
      iconColor="text"
      title={meta.title}
      subtitle={meta.access}
      value={value}
      chevron={opens}
      onPress={opens ? () => router.push({ pathname: '/wed-connect', params: { app } }) : undefined}
      accessibilityLabel={`${meta.title}, ${appValue(state)}. ${meta.access}`}
    />
  );
}

// A coming-soon app: its words, and the button under them so it never crowds
function SoonRow({ app }: { app: AppId }) {
  const Colors = useColors();
  const styles = useStyles();
  const meta = appMeta(app);
  const notify = useWed((s) => s.apps[app].notify);
  const scale = Math.min(useFontScale('body'), 1.4);
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { width: Sizes.rowIcon * scale }]}>
        <Icon name={meta.icon} size={Sizes.icon * scale} color={Colors.text} />
      </View>
      <View style={styles.text}>
        <AppText>{meta.title}</AppText>
        <AppText variant="label" weight={400} color="text2">
          {meta.access}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !!notify }}
          accessibilityLabel={
            notify
              ? `We'll tell you when ${meta.title} is ready. Tap to stop`
              : `Tell me when ${meta.title} is ready`
          }
          onPress={() => {
            selectionHaptic();
            wed.notifyMe(app);
          }}
          hitSlop={4}
          style={({ pressed }) => [styles.notify, pressed && styles.pressed]}
        >
          {notify ? (
            <Icon name="checkmark" size={18} color={Colors.text} weight="semibold" />
          ) : null}
          <AppText weight={600}>{notify ? "We'll tell you" : "Tell me when it's ready"}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  icon: {
    alignItems: 'center',
    paddingTop: 1,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  notify: {
    minHeight: 40,
    paddingRight: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
  },
  pressed: {
    opacity: 0.5,
  },
}));
