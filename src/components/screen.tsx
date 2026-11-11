import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { makeStyles, Sizes } from '@/constants/theme';

type ScreenProps = ViewProps & {
  edges?: readonly Edge[];
  /** A plain white page (black in dark mode) instead of the grouped grey: the welcome screen and first questions. */
  plain?: boolean;
  /** Drawn behind the page, under the safe areas too: the first questions' wash. */
  backdrop?: ReactNode;
};

/**
 * The grey grouped page background with safe-area padding, for sheets and
 * simple pages. Scrolling pages with a title use NavScreen (components/nav)
 * instead, which scrolls under a floating bar.
 */
export function Screen({
  edges = ['top'],
  plain,
  backdrop,
  style,
  children,
  ...rest
}: ScreenProps) {
  const styles = useStyles();
  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, plain && styles.plain]}>
      {backdrop}
      <View style={[styles.content, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((Colors) => ({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  plain: {
    backgroundColor: Colors.canvas,
  },
  content: {
    flex: 1,
    paddingHorizontal: Sizes.pageGutter,
  },
}));
