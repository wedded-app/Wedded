import { useCreateVaultInvite } from '@/data/memory-vault';

/**
 * The vault's join link for guests, made the first time it's needed. Each
 * new link stays valid, so sharing again or printing the table card on this
 * visit reuses this one rather than making more. Null if it couldn't be made.
 */
export function useVaultLink(vaultId: string): () => Promise<string | null> {
  const invite = useCreateVaultInvite();
  return async () => {
    if (invite.data) return invite.data;
    try {
      return await invite.mutateAsync(vaultId);
    } catch {
      return null;
    }
  };
}
