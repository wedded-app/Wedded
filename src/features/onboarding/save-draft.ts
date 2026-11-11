import { useCallback, useEffect } from 'react';

import { useMyWeddings, useStartWedding } from '@/data/wedding';
import { useSession } from '@/features/auth/session';
import {
  clearWeddingDraft,
  draftPlan,
  getWeddingDraft,
  hasDraftPlan,
  useWeddingDraft,
} from '@/features/home/wedding-draft';

// One save at a time: Save my plan and signing in can both ask at once
let saving: Promise<void> | null = null;

/**
 * Saves the plan kept on this phone (made in the first questions before
 * signing in) to the account they're signed into, then forgets the phone's
 * copy. An account that already has a wedding keeps it (create_wedding
 * isn't called twice). Rejects when it couldn't be saved.
 */
export function useSaveDraftPlan() {
  const { mutateAsync, isPending } = useStartWedding();
  const save = useCallback(() => {
    saving ??= (async () => {
      const draft = getWeddingDraft();
      if (!hasDraftPlan(draft)) return;
      await mutateAsync(draftPlan(draft));
      clearWeddingDraft();
    })().finally(() => {
      saving = null;
    });
    return saving;
  }, [mutateAsync]);
  return { save, saving: isPending };
}

/**
 * Once someone with a plan on this phone signs in, by any door (Save my
 * plan, a heart, Ask), the plan goes to their account, so it's never lost.
 * An account that already has a wedding keeps its own, and the phone's copy
 * is let go. A save that fails is tried again the next time Home opens.
 */
export function useKeepDraftOnSignIn() {
  const { status } = useSession();
  const weddings = useMyWeddings();
  const draft = useWeddingDraft();
  const { save } = useSaveDraftPlan();
  const waiting = hasDraftPlan(draft);
  const hasWedding = weddings.data ? weddings.data.length > 0 : null;

  useEffect(() => {
    if (status !== 'signedIn' || !waiting || hasWedding === null) return;
    if (hasWedding) clearWeddingDraft();
    else save().catch(() => {});
  }, [status, waiting, hasWedding, save]);
}
