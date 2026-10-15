import * as WebBrowser from 'expo-web-browser';

import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { useLocale } from '@/i18n/locale-context';

const OFL = 'https://openfontlicense.org';

/** Who made each font, picture and piece of software the app ships with. */
const CREDITS: { section: string; rows: { name: string; by: string; url: string }[] }[] = [
  {
    section: 'fonts',
    rows: [
      { name: 'Fraunces', by: 'Undercase Type', url: OFL },
      { name: 'Inter', by: 'Rasmus Andersson', url: OFL },
    ],
  },
  {
    section: 'pictures',
    rows: [
      { name: 'welcomeVideo', by: 'Pexels', url: 'https://www.pexels.com/license/' },
      { name: 'Ionicons', by: 'Ionic', url: 'https://github.com/ionic-team/ionicons' },
    ],
  },
];

/**
 * Licences (Settings > About): the fonts, the welcome video and the icons,
 * who made each and under which licence, each opening that licence. Then a
 * line for the open-source software the app is built on. The full clip list
 * is in assets/videos/README.md.
 */
export default function LicencesScreen() {
  const { t } = useLocale();
  return (
    <NavScreen title={t('licences.title')}>
      {CREDITS.map((group) => (
        <ListSection
          key={group.section}
          header={t(`licences.${group.section}`)}
          footer={t(`licences.${group.section}Footer`)}
        >
          {group.rows.map((row) => {
            const name = row.name === 'welcomeVideo' ? t('licences.welcomeVideo') : row.name;
            return (
              <ListRow
                key={row.name}
                title={name}
                subtitle={t('licences.by', { name: row.by })}
                onPress={() => void WebBrowser.openBrowserAsync(row.url)}
              />
            );
          })}
        </ListSection>
      ))}
      <ListSection header={t('licences.software')} footer={t('licences.softwareFooter')}>
        <ListRow
          title="React Native, Expo, Supabase"
          subtitle={t('licences.openSource')}
          onPress={() => void WebBrowser.openBrowserAsync('https://opensource.org/license/mit')}
        />
      </ListSection>
    </NavScreen>
  );
}
