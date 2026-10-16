import { useWindowDimensions, View } from 'react-native';

import { AppText, useFontScale, useTypeStyle } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { makeStyles, Spacing, Typography, useColors } from '@/constants/theme';
import { ConnectorRow } from '@/features/wed/connector-row';
import { APPS, type AppMeta } from '@/features/wed/mock';
import { WED_BACK } from '@/features/wed/open-wed';

const GROUPS: { group: AppMeta['group']; header: string }[] = [
  { group: 'builtIn', header: 'Always on' },
  { group: 'connect', header: 'Connect' },
  { group: 'soon', header: 'Coming soon' },
];

/**
 * MOCKUP: Apps Wed can use, honestly: what's always on (Wedded itself, the
 * family, Maps and web pages, which only look, except messages with an OK), the
 * phone calendar to connect, and what's coming (Gmail plays a preview of how
 * connecting will work). Each row is a plain outlined icon, never a brand's
 * art. Instagram and WhatsApp never appear: Wed doesn't message anyone there.
 */
export default function WedAppsScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('label'), 1.4);
  // The lock sits level with the first line of the words beside it, at any
  // text size (the phone scales the line height along with the words)
  const { lineHeight } = useTypeStyle({ variant: 'label' });
  const { fontScale } = useWindowDimensions();
  const firstLine = lineHeight * Math.min(fontScale, Typography.label.maxScale);

  return (
    <NavScreen title="Apps Wed can use" backTo={WED_BACK}>
      {GROUPS.map(({ group, header }) => (
        <ListSection key={group} inset header={header}>
          {APPS.filter((app) => app.group === group).map((app) => (
            <ConnectorRow key={app.id} app={app.id} />
          ))}
        </ListSection>
      ))}

      <View style={styles.never}>
        <View style={[styles.lock, { height: firstLine }]}>
          <Icon name="lock-closed-outline" size={16 * scale} color={Colors.text2} />
        </View>
        <AppText variant="label" weight={400} color="text2" style={styles.grow}>
          Wed never messages anyone on Instagram or WhatsApp, never texts or calls vendors, and
          never sends from your email.
        </AppText>
      </View>
    </NavScreen>
  );
}

const useStyles = makeStyles(() => ({
  never: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    // Closer to the sections above than the page's usual gap: it's their footer
    marginTop: -Spacing.sm,
  },
  lock: {
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
}));
