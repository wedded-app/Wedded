/** Service jobs must present the actual configured secret, never an unverified JWT claim. */
export function isServiceRequest(request: Request, serviceKey: string): boolean {
  if (!serviceKey) return false;
  const header = request.headers.get('Authorization');
  const match = header ? /^Bearer ([^\s]+)$/i.exec(header) : null;
  if (!match || match[1].length !== serviceKey.length) return false;
  let different = 0;
  for (let i = 0; i < serviceKey.length; i++) {
    different |= serviceKey.charCodeAt(i) ^ match[1].charCodeAt(i);
  }
  return different === 0;
}

export function quietMinutes(body: unknown): number | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).quietMinutes ?? 3;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1440
    ? value
    : null;
}
