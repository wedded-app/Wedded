import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { cardPageHtml } from './card-designs';

/** On the web there's no Photos or share sheet: Save and Share download the picture. */
async function download(card: RefObject<View | null>): Promise<void> {
  const link = document.createElement('a');
  link.href = await captureRef(card, { format: 'png', result: 'data-uri' });
  link.download = 'invitation.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function saveCard(card: RefObject<View | null>): Promise<boolean> {
  await download(card);
  return true;
}

export async function shareCard(card: RefObject<View | null>): Promise<void> {
  await download(card);
}

/** expo-print on the web prints the current page, so the card goes in its own window. */
export async function printCard(card: RefObject<View | null>): Promise<void> {
  const base64 = await captureRef(card, { format: 'png', result: 'base64' });
  const page = globalThis.open('', '_blank');
  if (!page) throw new Error('Pop-up blocked');
  page.document.write(cardPageHtml(base64));
  page.document.close();
  page.focus();
  // Print once the picture has loaded, or the page prints blank.
  const picture = page.document.images[0];
  if (picture.complete) page.print();
  else picture.onload = () => page.print();
}
