import { useDraftPlanView, usePlanView } from './use-plan-view';

/**
 * The family's plan, wherever it lives: their account's (Plan together), or
 * the one kept on this phone from the first questions before they had an
 * account. The vendor page's date ticket and Ask for a quote use it.
 */
export function useFamilyPlan() {
  const account = usePlanView();
  const phone = useDraftPlanView();
  if (account.wedding || account.loading) return account;
  return {
    ...account,
    plan: phone.plan,
    events: phone.events,
    chosen: phone.chosen,
    needsByEvent: phone.needsByEvent,
  };
}
