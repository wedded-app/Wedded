import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { uploadChatPhoto, type useSendMessage } from '@/data/chat';
import { askMediaAccess } from '@/features/reels/media-access';
import { useLocale } from '@/i18n/locale-context';

import { preparePhoto, rememberSentPhoto } from './chat-photo';

/** A photo on its way: shown at once, then replaced by the sent message. */
export type PhotoUpload = {
  id: string;
  /** The picked photo on this phone. */
  uri: string;
  width: number;
  height: number;
  createdAt: string;
  status: 'sending' | 'failed';
  /** Set once uploaded, so trying again only sends the message. */
  path?: string;
  /** The message this photo replies to (swipe to reply), if any. */
  replyTo?: string | null;
};

type Send = ReturnType<typeof useSendMessage>;

/** iOS drops a permission question asked while an alert is still closing. */
const afterAlert = () => new Promise((resolve) => setTimeout(resolve, 400));

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

/**
 * The chat's photo button: says why before the phone asks for Photos (once),
 * offers Settings after a no, picks one image, then shows it straight away
 * as "Sending…" while it's shrunk, uploaded and sent. A failure stays in the
 * thread with Try again and Remove.
 */
export function usePhotoSender(conversationId: string, send: Send) {
  const { t } = useLocale();
  const [uploads, setUploads] = useState<PhotoUpload[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (id: string, change: Partial<PhotoUpload>) =>
    setUploads((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u)));
  const remove = (id: string) => setUploads((all) => all.filter((u) => u.id !== id));

  // Browsers open their own file picker and need no permission
  async function allowed(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    const current = await ImagePicker.getMediaLibraryPermissionsAsync().catch(() => null);
    if (current?.granted) return true;
    if (current?.canAskAgain !== false) {
      const go = await ask(
        t('chat.photos.whyTitle'),
        t('chat.photos.whyBody'),
        t('chat.photos.notNow'),
        t('chat.photos.continue'),
      );
      if (!go) return false;
      await afterAlert();
      const access = await askMediaAccess('library');
      if (access === 'granted') return true;
      if (access === 'denied') {
        setNotice(t('chat.photos.needAccess'));
        return false;
      }
    }
    const open = await ask(
      t('chat.photos.blockedTitle'),
      t('chat.photos.blockedBody'),
      t('chat.photos.notNow'),
      t('chat.photos.openSettings'),
    );
    if (open) void Linking.openSettings();
    return false;
  }

  async function deliver(upload: PhotoUpload) {
    update(upload.id, { status: 'sending' });
    let { path, width, height } = upload;
    try {
      if (!path) {
        const ready = await preparePhoto(upload);
        path = await uploadChatPhoto(conversationId, ready.bytes, 'image/jpeg');
        rememberSentPhoto(path, ready.uri);
        ({ width, height } = ready);
        update(upload.id, { path, width, height });
      }
      // The sent message shows from here on (from the phone's copy)
      remove(upload.id);
      await send.mutateAsync({ kind: 'photo', path, width, height, replyTo: upload.replyTo });
    } catch {
      setUploads((all) => [
        ...all.filter((u) => u.id !== upload.id),
        { ...upload, path, width, height, status: 'failed' },
      ]);
    }
  }

  /** Pick and send one photo, as a reply when `replyTo` is set. Says whether one was picked. */
  async function pick(replyTo?: string | null): Promise<boolean> {
    setNotice(null);
    if (!(await allowed())) return false;
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    } catch {
      setNotice(t('chat.photos.cantOpen'));
      return false;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return false;
    const upload: PhotoUpload = {
      id: `upload-${Date.now()}`,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      createdAt: new Date().toISOString(),
      status: 'sending',
      replyTo: replyTo ?? null,
    };
    setUploads((all) => [...all, upload]);
    void deliver(upload);
    return true;
  }

  return {
    uploads,
    notice,
    pick,
    retry: (upload: PhotoUpload) => void deliver(upload),
    remove,
  };
}
