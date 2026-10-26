import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { useFoundingVendors } from '@/data/vendors';
import { i18n } from '@/i18n';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/** For link previews: since SDK 58 only this reaches the page's HTML, not Head's tags. */
export function generateMetadata() {
  return { title: i18n.t('founding.title'), description: i18n.t('founding.intro') };
}

/**
 * The Founding Wall (vision doc §13): vendors with a founding number, in the
 * order they joined, each opening their profile. Deep link: /founding.
 */
export default function FoundingWallScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLocale();
  const vendors = useFoundingVendors();

  let body;
  if (vendors.isPending) body = <StateView state="loading" />;
  else if (vendors.isError) {
    body = <StateView state="error" onRetry={() => void vendors.refetch()} />;
  } else if (vendors.data.length === 0) {
    body = <StateView state="empty" icon="ribbon-outline" message={t('founding.empty')} />;
  } else {
    body = (
      <ListSection>
        {vendors.data.map((item) => {
          const name = localized(item.name);
          const details = [item.category && localized(item.category), item.city]
            .filter(Boolean)
            .join(' · ');
          return (
            <ListRow
              key={item.slug}
              title={name}
              titleVariant="bodyLg"
              subtitle={item.isSample ? `${details} · ${t('sample.tag')}` : details}
              accessibilityLabel={t('founding.rowSpoken', {
                number: item.foundingNumber,
                name,
                details,
              })}
              leading={
                <View style={styles.number}>
                  <AppText variant="button" color="kesari" style={styles.tabular}>
                    {`#${item.foundingNumber}`}
                  </AppText>
                </View>
              }
              onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: item.slug } })}
            />
          );
        })}
      </ListSection>
    );
  }

  return (
    <NavScreen title={t('founding.title')} subtitle={t('founding.intro')}>
      <Head>
        <title>{t('founding.title')}</title>
        <meta name="description" content={t('founding.intro')} />
      </Head>
      {body}
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  number: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.circle,
    backgroundColor: Colors.kesariTint,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}));
