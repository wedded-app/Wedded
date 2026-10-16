import { useSyncExternalStore, type ReactNode } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, useColors } from '@/constants/theme';

// An iPhone 17 Pro Max screen in points, with its safe areas.
const PHONE = { width: 440, height: 956, top: 62, bottom: 34, radius: 62 };
// Below this window width the page is on a phone (a QR code or shared link),
// so it fills the screen as usual.
const FRAME_FROM_WIDTH = 700;

/**
 * On a computer's browser, shows the app inside an iPhone-sized screen with
 * the status bar, Dynamic Island and home indicator, so the web preview
 * reads as the phone app instead of a page stretched across a monitor.
 * Screens lay out against the phone's safe areas. Phones and native builds
 * render the app as is.
 */
export function WebFrame({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const window = useWindowDimensions();
  // The web build renders pages ahead of time without a window, so the frame
  // waits until the page is live in a browser (no hydration mismatch).
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (Platform.OS !== 'web' || !inBrowser || window.width < FRAME_FROM_WIDTH) return children;

  // Shrink to fit short windows, keeping the phone's proportions.
  const scale = Math.min(1, (window.height - 48) / PHONE.height);

  return (
    <View style={styles.desk}>
      <View style={[styles.bezel, { transform: [{ scale }] }]}>
        <View style={styles.screen}>
          <SafeAreaFrameContext.Provider
            value={{ x: 0, y: 0, width: PHONE.width, height: PHONE.height }}
          >
            <SafeAreaInsetsContext.Provider
              value={{ top: PHONE.top, bottom: PHONE.bottom, left: 0, right: 0 }}
            >
              {children}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
          <StatusBar />
          <View style={styles.homeIndicator} />
        </View>
      </View>
    </View>
  );
}

const noSubscription = () => () => {};

function StatusBar() {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.statusBar} aria-hidden>
      <AppText variant="button" style={styles.time}>
        9:41
      </AppText>
      <View style={styles.island} />
      <View style={styles.statusIcons}>
        <Icon name="cellular" size={17} color={Colors.text} />
        <Icon name="wifi" size={17} color={Colors.text} />
        <Icon name="battery-full" size={24} color={Colors.text} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  desk: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.desk,
  },
  bezel: {
    padding: 14,
    borderRadius: PHONE.radius + 14,
    backgroundColor: '#1D1D1F',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.25), inset 0 0 0 2px #3A3A3C',
  },
  screen: {
    width: PHONE.width,
    height: PHONE.height,
    borderRadius: PHONE.radius,
    overflow: 'hidden',
    backgroundColor: Colors.bg,
  },
  statusBar: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PHONE.top - 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    zIndex: 1000,
  },
  time: {
    width: 80,
    textAlign: 'center',
  },
  island: {
    width: 126,
    height: 37,
    borderRadius: 999,
    backgroundColor: '#000000',
  },
  statusIcons: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  homeIndicator: {
    pointerEvents: 'none',
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    width: 150,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.text,
    zIndex: 1000,
  },
}));
