import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { saveToPhotos } from '@/lib/save-to-photos';

import { cardPageHtml } from './card-designs';
import { CARD_RATIO } from './invitation-card';

/** 1500 by 2100 pixels: sharp on a phone and on a printed 5 by 7 card. */
const PIXELS = 1500;

/** The card as a PNG (a file, or base64 for printing). */
function capture(card: RefObject<View | null>, result: 'tmpfile' | 'base64') {
  const width = PIXELS / PixelRatio.get();
  return captureRef(card, { format: 'png', quality: 1, result, width, height: width * CARD_RATIO });
}

/** Adds the card to Photos. False when that isn't allowed or doesn't work. */
export async function saveCard(card: RefObject<View | null>): Promise<boolean> {
  return saveToPhotos(await capture(card, 'tmpfile'));
}

/** The share sheet, to send the card on WhatsApp, Messages, email and so on. */
export async function shareCard(card: RefObject<View | null>, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  await Sharing.shareAsync(await capture(card, 'tmpfile'), {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: title,
  });
}

/** The print sheet, which also saves a PDF: one card a page. */
export async function printCards(cards: RefObject<View | null>[]): Promise<void> {
  const pictures: string[] = [];
  for (const card of cards) pictures.push(await capture(card, 'base64'));
  await Print.printAsync({ html: cardPageHtml(pictures) });
}

/** The card as a PNG file, to attach to a text or an email. */
export function cardFile(card: RefObject<View | null>): Promise<string> {
  return capture(card, 'tmpfile');
}
