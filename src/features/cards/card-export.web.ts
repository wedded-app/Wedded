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

/** expo-print on the web prints the current page, so the cards go in their own window. */
export async function printCards(cards: RefObject<View | null>[]): Promise<void> {
  const pictures: string[] = [];
  for (const card of cards)
    pictures.push(await captureRef(card, { format: 'png', result: 'base64' }));
  const page = globalThis.open('', '_blank');
  if (!page) throw new Error('Pop-up blocked');
  page.document.write(cardPageHtml(pictures));
  page.document.close();
  page.focus();
  // Print once the pictures have loaded, or the page prints blank.
  const images = [...page.document.images];
  let left = images.filter((picture) => !picture.complete).length;
  if (left === 0) page.print();
  for (const picture of images) {
    if (picture.complete) continue;
    picture.onload = () => {
      left -= 1;
      if (left === 0) page.print();
    };
  }
}

/** No texting or Mail on the web; the picture, for parity with the phone. */
export function cardFile(card: RefObject<View | null>): Promise<string> {
  return captureRef(card, { format: 'png', result: 'data-uri' });
}
