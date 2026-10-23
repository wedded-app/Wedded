/**
 * Push alerts for new messages (C5f, #160). This phone registers its Expo
 * push token with the account (register_push_token), and the push-chat Edge
 * Function buzzes it for every new message from the other side. Expo Go
 * delivers them on iPhone; Android needs a development build (SDK 53+), so
 * there it reports 'unavailable'. The web build uses push.web.ts.
 *
 * - configurePushHandling(): once at startup (root layout).
 * - pushStatus() / enablePush(): the "Turn on message alerts" ask; only ever
 *   ask after saying why.
 * - syncPushToken(): on sign-in, re-registers silently when already allowed.
 * - forgetThisPhone(): before signing out, so the next person on this phone
 *   doesn't get their alerts.
 * - setOpenConversation(id): the chat on screen, whose alerts don't pop up.
 * - usePushOpens(open): tapping an alert opens its chat.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const ANDROID_CHANNEL = 'messages';

let openConversation: string | null = null;

/** The chat on screen right now (null when none): its alerts don't pop up. */
export function setOpenConversation(conversationId: string | null): void {
  openConversation = conversationId;
}

/** Alerts can reach this phone at all: a real phone, and not Expo Go on Android. */
export function pushSupported(): boolean {
  if (!Device.isDevice) return false;
  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  return !(expoGo && Platform.OS === 'android');
}

/** Show alerts while the app is open, except for the chat already on screen. */
export function configurePushHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as
        { conversationId?: unknown; threadId?: unknown } | undefined;
      // A chat or a group thread; setOpenConversation takes either id
      const id = data?.conversationId ?? data?.threadId;
      const onScreen = typeof id === 'string' && id === openConversation;
      return {
        shouldShowBanner: !onScreen,
        shouldShowList: !onScreen,
        shouldPlaySound: !onScreen,
        shouldSetBadge: false,
      };
    },
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Messages',
      importance: AndroidImportance.HIGH,
    }).catch(() => undefined);
  }
}

/** Whether alerts are allowed, not asked yet, refused, or impossible here. */
export async function pushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unavailable';
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted || isProvisional(permission)) return 'granted';
    return permission.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

function isProvisional(permission: Notifications.NotificationPermissionsStatus): boolean {
  return permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function registerToken(): Promise<boolean> {
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: platform,
    });
    if (error) return false;
    await writeSetting(StorageKeys.pushToken, token);
    return true;
  } catch {
    // Offline, or Expo's servers didn't answer: try again next sign-in or open
    return false;
  }
}

/**
 * Ask to send alerts (the system prompt, once) and register this phone.
 * Call it from a button that has already said why.
 */
export async function enablePush(): Promise<'enabled' | 'denied' | 'unavailable' | 'failed'> {
  if (!pushSupported()) return 'unavailable';
  try {
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && !isProvisional(permission) && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted && !isProvisional(permission)) return 'denied';
  } catch {
    return 'unavailable';
  }
  return (await registerToken()) ? 'enabled' : 'failed';
}

/** Re-register quietly when alerts are already allowed (tokens can change). Never asks. */
export async function syncPushToken(): Promise<void> {
  if ((await pushStatus()) === 'granted') await registerToken();
}

/** Stop this phone's alerts for the signed-in person. Call before signing out. */
export async function forgetThisPhone(): Promise<void> {
  const token = readSetting(StorageKeys.pushToken);
  if (!token) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {
    // Signing out still works; the token moves on the next sign-in anyway
  }
  await writeSetting(StorageKeys.pushToken, '');
}

/** The chat or group thread an alert opens, from its data. */
export function chatUrlOf(data: unknown): string | null {
  const d = data as { url?: unknown; conversationId?: unknown } | null | undefined;
  if (typeof d?.url === 'string' && /^\/(chat|group)\/[0-9a-f-]{36}$/.test(d.url)) return d.url;
  if (typeof d?.conversationId === 'string' && /^[0-9a-f-]{36}$/.test(d.conversationId)) {
    return `/chat/${d.conversationId}`;
  }
  return null;
}

/**
 * Open the chat when an alert is tapped: while the app runs, and the one that
 * started the app. `open` gets "/chat/<id>".
 */
export function usePushOpens(open: (url: string) => void): void {
  const handled = useRef<string | null>(null);
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = chatUrlOf(last.notification.request.content.data);
    if (url) open(url);
  }, [last, open]);
}
