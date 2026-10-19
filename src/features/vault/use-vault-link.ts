import { useCreateVaultInvite, vaultInviteLink } from '@/data/memory-vault';

/**
 * The vault's join link for guests, made the first time it's needed. Sharing
 * it again or printing the table card reuses the same link. Null if it
 * couldn't be made.
 */
export function useVaultLink(vaultId: string): () => Promise<string | null> {
  const invite = useCreateVaultInvite();
  return async () => {
    if (invite.data) return vaultInviteLink(invite.data);
    try {
      return vaultInviteLink(await invite.mutateAsync(vaultId));
    } catch {
      return null;
    }
  };
}
