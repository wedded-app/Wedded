import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { GlassButton } from '@/components/glass-button';
import { Icon, type IconName } from '@/components/icon';
import { IconLine } from '@/components/icon-line';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { EVENTS, FAMILY } from '@/features/wed/mock';
import { openWed } from '@/features/wed/open-wed';
import { getWed, useWed, wed, type AppState } from '@/features/wed/wed-store';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

type Connectable = 'gmail' | 'calendar';
type Level = 'vendors' | 'all';
type Step = 'access' | 'google' | 'done' | 'manage';

const LEVELS: { value: Level; title: string; subtitle: string }[] = [
  {
    value: 'vendors',
    title: 'Only emails from your vendors',
    subtitle: "People you've asked through Wedded, or that you add.",
  },
  {
    value: 'all',
    title: 'All wedding emails',
    subtitle: 'Also emails with words like quote, deposit or booking.',
  },
];

const NEVER =
  'Wed never sends from your Gmail, never deletes anything and never reads anything else.';

// The events a subscribed calendar shows, as a taste of what's coming
const CALENDAR_SAMPLE = EVENTS.filter((event) => event.slug !== 'roka').slice(0, 3);

const isOn = (app: AppState) => app.status === 'connected' || app.status === 'preview';

function levelWords(app: Connectable, level?: string) {
  if (app === 'calendar') return 'Adds tours and event dates';
  return (LEVELS.find((option) => option.value === level) ?? LEVELS[0]).title;
}

/**
 * MOCKUP: connecting an app to Wed, as a sheet (/wed-connect?app=gmail|calendar).
 * Gmail isn't live yet, so it plays a preview of how connecting will work:
 * what Wed may read, then a plain stand-in for Google's account picker (our
 * own panel, never a copy of Google's page), then connected, which posts in
 * the chat what Wed found. The phone calendar is a feed to subscribe to, with
 * nothing to sign in to. Opened on an app that's already on, it shows what
 * Wed can see and Disconnect.
 */
export default function WedConnectSheet() {
  const { app: param } = useLocalSearchParams<{ app?: string }>();
  const app: Connectable = param === 'calendar' ? 'calendar' : 'gmail';
  // Where the sheet starts is decided once: connecting mid-flow mustn't
  // jump it to the connected page before Done
  const [step, setStep] = useState<Step>(() => (isOn(getWed().apps[app]) ? 'manage' : 'access'));
  const [level, setLevel] = useState<Level>('vendors');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/wed/apps'));

  let title = app === 'calendar' ? 'Phone calendar' : 'Connect Gmail';
  if (step === 'manage' && app === 'gmail') title = 'Gmail';

  let content: ReactNode;
  if (step === 'manage') {
    content = <Manage app={app} onDisconnect={close} />;
  } else if (step === 'done') {
    content = <Connected app={app} level={level} onDone={close} />;
  } else if (app === 'calendar') {
    content = (
      <CalendarStep
        onSubscribe={() => {
          wed.connect('calendar', 'subscribed');
          setStep('done');
        }}
      />
    );
  } else if (step === 'google') {
    content = (
      <GoogleStep
        level={level}
        onAllow={() => {
          wed.connect('gmail', level);
          setStep('done');
        }}
      />
    );
  } else {
    content = (
      <AccessStep
        level={level}
        onLevel={(next) => {
          if (next !== level) selectionHaptic();
          setLevel(next);
        }}
        onContinue={() => setStep('google')}
      />
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader
        onClose={close}
        title={title}
        leading={step === 'google' ? <BackToAccess onPress={() => setStep('access')} /> : null}
      />
      {/* Each step fades in as the one before it goes */}
      <Animated.View key={step} entering={Motion.enter} style={{ flex: 1 }}>
        {content}
      </Animated.View>
    </Screen>
  );
}

// Gmail, step 1: the preview banner, what Wed may read, and what it never does
function AccessStep({
  level,
  onLevel,
  onContinue,
}: {
  level: Level;
  onLevel: (level: Level) => void;
  onContinue: () => void;
}) {
  const styles = useStyles();
  return (
    <Body footer={<Button label="Continue to Google" onPress={onContinue} />}>
      <View style={styles.banner}>
        <AppText>
          <AppText weight={600} color="kesari">
            Preview
          </AppText>
          {" · Gmail isn't live yet. This shows how it will work."}
        </AppText>
      </View>
      <Intro icon="mail-outline">
        Wed reads emails from your vendors so quotes and replies are in one place.
      </Intro>
      <ListSection header="What Wed can read">
        {LEVELS.map((option) => (
          <ListRow
            key={option.value}
            title={option.title}
            subtitle={option.subtitle}
            accessibilityRole="radio"
            checked={level === option.value}
            onPress={() => onLevel(option.value)}
          />
        ))}
      </ListSection>
      <IconLine icon="lock-closed-outline" color="text2">
        {NEVER}
      </IconLine>
    </Body>
  );
}

// Gmail, step 2: a neutral stand-in for where Google asks which account
function GoogleStep({ level, onAllow }: { level: Level; onAllow: () => void }) {
  return (
    <Body footer={<Button label="Allow read-only access" onPress={onAllow} />}>
      <Intro icon="person-circle-outline">
        {/* A no-break space keeps "here." off a line of its own */}
        {'Google asks you to pick your account here.'}
      </Intro>
      <ListSection>
        <ListRow
          icon="person-circle-outline"
          iconColor="text"
          title={FAMILY.email}
          subtitle={FAMILY.signature}
          accessibilityRole="radio"
          checked
        />
      </ListSection>
      <IconLine icon="lock-closed-outline" color="text2">
        {`Read only · ${levelWords('gmail', level)}`}
      </IconLine>
    </Body>
  );
}

// The phone calendar, its one step: a feed, so nothing to sign in to
function CalendarStep({ onSubscribe }: { onSubscribe: () => void }) {
  return (
    <Body footer={<Button label="Subscribe" onPress={onSubscribe} />}>
      <Intro icon="calendar-outline" title="Add tours and dates to your phone calendar">
        {"Your calendar follows a feed from Wedded, so there's nothing to sign in to."}
      </Intro>
      <ListSection inset header="What shows up">
        <ListRow icon="time-outline" iconColor="text" title="Tours and tastings you book" />
        {CALENDAR_SAMPLE.map((event) => (
          <ListRow
            key={event.slug}
            icon="calendar-outline"
            iconColor="text"
            title={event.name}
            subtitle={event.when}
          />
        ))}
      </ListSection>
    </Body>
  );
}

// Step 3: done, with a check that pops in
function Connected({ app, level, onDone }: { app: Connectable; level: Level; onDone: () => void }) {
  const Colors = useColors();
  const styles = useStyles();
  const gmail = app === 'gmail';
  return (
    <Body
      center
      footer={
        <>
          <Button label="Done" onPress={onDone} />
          {gmail ? (
            <Button variant="text" label="See what Wed found" onPress={() => openWed()} />
          ) : null}
        </>
      }
    >
      <View style={styles.done} accessible accessibilityLiveRegion="polite">
        <Animated.View entering={Motion.popIn}>
          <Icon name="checkmark-circle" size={56} color={Colors.success} />
        </Animated.View>
        <AppText variant="title" accessibilityRole="header" style={styles.center}>
          {gmail ? 'Gmail connected' : 'Phone calendar connected'}
        </AppText>
        <AppText color="text2" style={styles.center}>
          {gmail
            ? `A preview · ${levelWords('gmail', level)}`
            : 'Tours and event dates will show up there.'}
        </AppText>
      </View>
    </Body>
  );
}

// An app that's already on: what Wed can see, and Disconnect
function Manage({ app, onDisconnect }: { app: Connectable; onDisconnect: () => void }) {
  const state = useWed((s) => s.apps[app]);
  const gmail = app === 'gmail';
  return (
    <Body
      footer={
        <Button
          variant="danger"
          label="Disconnect"
          accessibilityLabel={gmail ? 'Disconnect Gmail' : 'Disconnect your phone calendar'}
          onPress={() => {
            selectionHaptic();
            wed.disconnect(app);
            onDisconnect();
          }}
        />
      }
    >
      <Intro
        icon={gmail ? 'mail-outline' : 'calendar-outline'}
        title={gmail ? 'Gmail (preview)' : 'Phone calendar'}
      >
        Connected
      </Intro>
      <ListSection inset>
        <ListRow icon="options-outline" iconColor="text" title={levelWords(app, state.level)} />
        <ListRow icon="time-outline" iconColor="text" title="Last used today" />
      </ListSection>
      {gmail ? (
        <IconLine icon="lock-closed-outline" color="text2">
          {NEVER}
        </IconLine>
      ) : null}
    </Body>
  );
}

// ---------------------------------------------------------------------------

/** A step's scrolling words, with its buttons pinned under them. */
function Body({
  children,
  footer,
  center = false,
}: {
  children: ReactNode;
  footer: ReactNode;
  center?: boolean;
}) {
  const styles = useStyles();
  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, center && styles.centered]}
      >
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </>
  );
}

/** The top of a step: the app's plain glyph in a circle, a title, and a line. */
function Intro({ icon, title, children }: { icon: IconName; title?: string; children: string }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.intro}>
      <View style={styles.badge}>
        <Icon name={icon} size={28} color={Colors.text} />
      </View>
      {title ? (
        <AppText variant="heading" accessibilityRole="header" style={styles.center}>
          {title}
        </AppText>
      ) : null}
      <AppText color={title ? 'text2' : 'text'} style={styles.center}>
        {children}
      </AppText>
    </View>
  );
}

function BackToAccess({ onPress }: { onPress: () => void }) {
  const Colors = useColors();
  return (
    <GlassButton
      icon="chevron-back"
      color={Colors.text}
      accessibilityLabel="Back"
      onPress={onPress}
      size={44}
    />
  );
}

const useStyles = makeStyles((Colors) => ({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footer: {
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  banner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    backgroundColor: Colors.kesariTint,
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  badge: {
    width: Sizes.iconCircle,
    height: Sizes.iconCircle,
    borderRadius: Sizes.iconCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  done: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
}));
