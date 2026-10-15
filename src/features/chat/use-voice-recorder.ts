import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { MAX_VOICE_MS, uploadChatVoice, type useSendMessage } from '@/data/chat';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { rememberSentPhoto } from './chat-photo';
import { MIN_VOICE_MS, voiceContentType } from './voice';

type Send = ReturnType<typeof useSendMessage>;

/** iOS drops a permission question asked while an alert is still closing. */
const afterAlert = () => new Promise((resolve) => setTimeout(resolve, 400));

/**
 * idle; held (recording while the finger is down: letting go sends);
 * locked (a tap started it: Cancel or Send); sending.
 */
export type VoiceMode = 'idle' | 'held' | 'locked' | 'sending';

/** Shows a native question and says which button was pressed. */
function ask(title: string, body: string, no: string, yes: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      body,
      [
        { text: no, style: 'cancel', onPress: () => resolve(false) },
        { text: yes, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  // Browsers hand back a blob: link, which File can't open
  return Platform.OS === 'web' ? (await fetch(uri)).arrayBuffer() : new File(uri).arrayBuffer();
}

/**
 * The microphone in the chat Composer (C5e). Hold to record and let go to
 * send, as in WhatsApp; or tap to record hands-free, then Cancel or Send,
 * which is easier for elders and how screen readers record. The phone asks
 * for the microphone only on first use, after saying why, and offers Open
 * Settings after a no. Under a second is dropped with a hint; 5 minutes is
 * the most. A failed send keeps the recording for Try again.
 */
export function useVoiceRecorder(conversationId: string, send: Send) {
  const { t } = useLocale();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 250);
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ uri: string; durationMs: number } | null>(null);
  const startedAt = useRef(0);
  // Let go while the microphone was still starting
  const releasedEarly = useRef(false);
  const starting = useRef(false);
  // Stops a recording at five minutes, the most a voice note can be
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function allowed(): Promise<boolean> {
    // Browsers ask on their own
    if (Platform.OS === 'web') return (await requestRecordingPermissionsAsync()).granted;
    const current = await getRecordingPermissionsAsync().catch(() => null);
    if (current?.granted) return true;
    if (current?.canAskAgain !== false) {
      const go = await ask(
        t('chat.voice.whyTitle'),
        t('chat.voice.whyBody'),
        t('chat.photos.notNow'),
        t('chat.photos.continue'),
      );
      if (!go) return false;
      await afterAlert();
      const asked = await requestRecordingPermissionsAsync().catch(() => null);
      if (asked?.granted) return true;
      if (asked?.canAskAgain !== false) {
        setNotice(t('chat.voice.needAccess'));
        return false;
      }
    }
    const open = await ask(
      t('chat.voice.blockedTitle'),
      t('chat.voice.blockedBody'),
      t('chat.photos.notNow'),
      t('chat.photos.openSettings'),
    );
    if (open) void Linking.openSettings();
    return false;
  }

  async function stopRecording(): Promise<{ uri: string | null; durationMs: number }> {
    if (limit.current) clearTimeout(limit.current);
    limit.current = null;
    const durationMs = Math.min(Date.now() - startedAt.current, MAX_VOICE_MS);
    try {
      await recorder.stop();
    } catch {
      // Already stopped
    }
    void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    return { uri: recorder.uri, durationMs };
  }

  async function deliver(uri: string, durationMs: number) {
    setMode('sending');
    setFailed(null);
    try {
      const path = await uploadChatVoice(
        conversationId,
        await readBytes(uri),
        voiceContentType(uri),
      );
      // The sender plays it back from the phone's copy
      rememberSentPhoto(path, uri);
      await send.mutateAsync({ kind: 'voice', path, durationMs });
      setMode('idle');
    } catch {
      setFailed({ uri, durationMs });
      setNotice(t('chat.voice.failed'));
      setMode('idle');
    }
  }

  async function finish() {
    const { uri, durationMs } = await stopRecording();
    if (!uri || durationMs < MIN_VOICE_MS) {
      setMode('idle');
      setNotice(t('chat.voice.tooShort'));
      return;
    }
    await deliver(uri, durationMs);
  }

  async function start(next: 'held' | 'locked') {
    if (mode !== 'idle' || starting.current) return;
    starting.current = true;
    releasedEarly.current = false;
    setNotice(null);
    setFailed(null);
    try {
      if (!(await allowed())) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      limit.current = setTimeout(() => void finish(), MAX_VOICE_MS);
      selectionHaptic();
      setMode(next);
      // Let go before it started: too short to keep
      if (next === 'held' && releasedEarly.current) await finish();
    } catch (error) {
      console.warn('Voice note: the microphone did not start', error);
      setNotice(t('chat.voice.cantRecord'));
      setMode('idle');
    } finally {
      starting.current = false;
    }
  }

  async function cancel() {
    await stopRecording();
    setMode('idle');
  }

  const elapsedMs = mode === 'held' || mode === 'locked' ? status.durationMillis : 0;

  return {
    mode,
    elapsedMs,
    notice,
    failed: failed !== null,
    /** The finger went down and stayed: record until it lifts. */
    hold: () => void start('held'),
    /** The finger lifted. */
    release: () => {
      if (starting.current) releasedEarly.current = true;
      else if (mode === 'held') void finish();
    },
    /** A quick tap: record hands-free. */
    tap: () => void start('locked'),
    sendNow: () => void finish(),
    cancel: () => void cancel(),
    retry: () => {
      if (failed) void deliver(failed.uri, failed.durationMs);
    },
    dismiss: () => {
      setFailed(null);
      setNotice(null);
    },
  };
}
