/** Push alerts don't reach the web build: every call is a no-op (see push.ts). */
export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export function setOpenConversation(_conversationId: string | null): void {}

export function pushSupported(): boolean {
  return false;
}

export function configurePushHandling(): void {}

export async function pushStatus(): Promise<PushStatus> {
  return 'unavailable';
}

export async function enablePush(): Promise<'enabled' | 'denied' | 'unavailable' | 'failed'> {
  return 'unavailable';
}

export async function syncPushToken(): Promise<void> {}

export async function forgetThisPhone(): Promise<void> {}

export function chatUrlOf(_data: unknown): string | null {
  return null;
}

export function usePushOpens(_open: (url: string) => void): void {}
