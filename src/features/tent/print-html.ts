import * as Print from 'expo-print';
import { Platform } from 'react-native';

/** Print a page (the QR table tent or the vault's table card). False if it didn't open. */
export async function printHtml(html: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // expo-print on the web prints the current page, not this HTML.
      const page = globalThis.open('', '_blank');
      if (!page) throw new Error('Pop-up blocked');
      page.document.write(html);
      page.document.close();
      page.focus();
      page.print();
    } else {
      await Print.printAsync({ html });
    }
    return true;
  } catch {
    return false;
  }
}
