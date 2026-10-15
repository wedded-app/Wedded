import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/**
 * "Sample" next to a demo vendor, reel or request, so nobody takes made-up
 * listings for real businesses (legal checklist, #239). Shows nothing for real ones.
 */
export function SampleTag({
  show,
  onPhoto = false,
}: {
  show: boolean | undefined;
  onPhoto?: boolean;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  if (!show) return null;
  return (
    <View
      style={[styles.tag, onPhoto && styles.onPhoto]}
      accessible
      accessibilityLabel={t('sample.label')}
    >
      <AppText variant="caption" weight={600} color={onPhoto ? 'onPhoto' : 'text2'}>
        {t('sample.tag')}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.chip,
    backgroundColor: Colors.fill,
  },
  onPhoto: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
}));
