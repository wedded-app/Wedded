/**
 * The business phone on a listing with all but its last two digits hidden,
 * for "We'll call or text a code to (•••) •••-••01" when someone claims it.
 * Null when the listing has no phone.
 */
export function maskedPhone(e164: string | null): string | null {
  const digits = (e164 ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `(•••) •••-••${digits.slice(-2)}`;
}
