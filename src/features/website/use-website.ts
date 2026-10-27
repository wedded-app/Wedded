import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  siteProblem,
  useCreateSite,
  useMySiteSlug,
  useSitePage,
  type SitePage,
} from '@/data/website';
import { usePlanView } from '@/features/planner/use-plan-view';

export type WebsiteState =
  | { status: 'loading' }
  | { status: 'noWedding' }
  | { status: 'cantMake' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; site: SitePage; weddingId: string; canEdit: boolean };

/**
 * The family's own website for the builder's screens: the plan's wedding,
 * its site (made the first time an owner or editor opens Website) and the
 * page as the family sees it, drafts and every event included.
 */
export function useWebsite(): WebsiteState & { view: ReturnType<typeof usePlanView> } {
  const view = usePlanView();
  const wedding = view.wedding;
  const canEdit = view.canEdit;
  const slug = useMySiteSlug(wedding?.id ?? null);
  const create = useCreateSite();
  const needsSite = !!wedding && canEdit && slug.data === null;

  useEffect(() => {
    if (needsSite && wedding && create.isIdle) create.mutate(wedding.id);
  }, [needsSite, wedding, create]);

  const page = useSitePage(slug.data ?? '');

  // The link can change under the builder (named from the couple while it's a
  // draft, #411, or changed by another editor): when it's gone, read it again
  // before calling it an error
  const relink =
    page.isError &&
    siteProblem(page.error) === 'notFound' &&
    slug.dataUpdatedAt < page.errorUpdatedAt;
  const refetchSlug = slug.refetch;
  useEffect(() => {
    if (relink) void refetchSlug();
  }, [relink, refetchSlug]);

  // The site shows the plan's names, days, times and places: when the family
  // changes those (here or in My Wedding), show the change on the site too
  const queryClient = useQueryClient();
  const planShown = wedding
    ? JSON.stringify([
        wedding.title,
        wedding.events,
        wedding.eventDates,
        wedding.eventTimes,
        wedding.eventPlaces,
      ])
    : '';
  useEffect(() => {
    if (!slug.data) return;
    const refresh = () =>
      void queryClient.invalidateQueries({ queryKey: ['site', 'page', slug.data] });
    refresh();
    // Again once the plan's change has had time to save
    const later = setTimeout(refresh, 1500);
    return () => clearTimeout(later);
  }, [planShown, slug.data, queryClient]);
  const retry = () => {
    create.reset();
    void slug.refetch();
    void page.refetch();
  };

  if (view.loading || (wedding && slug.isPending)) return { status: 'loading', view };
  if (!wedding) return { status: 'noWedding', view };
  if (relink && !slug.isError) return { status: 'loading', view };
  if (slug.isError || create.isError || page.isError) return { status: 'error', retry, view };
  if (slug.data === null)
    return canEdit ? { status: 'loading', view } : { status: 'cantMake', view };
  if (page.isPending || !page.data || page.data.kind !== 'page') return { status: 'loading', view };
  return { status: 'ready', site: page.data.page, weddingId: wedding.id, canEdit, view };
}
