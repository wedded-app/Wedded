import { useTraditions, type TraditionEvent } from '@/data/reference';

import { useAnswers } from './answers';
import { eventChoices, startingChoice, traditionsForFaiths } from './faith';

/**
 * The events in the first questions, worked out from the answers so far:
 * what "Which events are you having?" offers (`main` ticked to start with,
 * `more` to add), the ones they've chosen, and those in ceremony order for
 * "When is each one?".
 */
export function useChosenEvents() {
  const answers = useAnswers();
  const traditions = useTraditions();
  const all = traditions.data ?? [];
  const picked = traditionsForFaiths(answers.faiths, answers.roots, all);
  const { main, more, ordered } = eventChoices(picked, all);
  const chosen = answers.events ?? startingChoice(main, ordered, answers.extraEvents);
  const inOrder: TraditionEvent[] = ordered.filter((event) => chosen.includes(event.slug));
  return {
    all,
    picked,
    main,
    more,
    chosen,
    inOrder,
    loading: traditions.isPending,
    failed: traditions.isError,
    retry: () => void traditions.refetch(),
  };
}
