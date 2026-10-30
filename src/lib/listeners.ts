/**
 * Who to tell when a small in-memory store changes: `subscribe` is what
 * useSyncExternalStore takes, and `notify` re-renders everyone using it.
 */
export function createListeners() {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      listeners.forEach((listener) => listener());
    },
  };
}
