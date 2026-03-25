/**
 * Typed pub/sub event system to replace raw window.dispatchEvent calls.
 */

type EventMap = {
  'checkin-added': void;
};

type EventCallback<T> = T extends void ? () => void : (data: T) => void;

const listeners = new Map<keyof EventMap, Set<EventCallback<unknown>>>();

export function subscribe<K extends keyof EventMap>(
  event: K,
  callback: EventCallback<EventMap[K]>,
): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  const set = listeners.get(event)!;
  set.add(callback as EventCallback<unknown>);

  // Return unsubscribe function
  return () => {
    set.delete(callback as EventCallback<unknown>);
    if (set.size === 0) {
      listeners.delete(event);
    }
  };
}

export function publish<K extends keyof EventMap>(
  event: K,
  ...args: EventMap[K] extends void ? [] : [EventMap[K]]
): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const cb of set) {
    (cb as (...a: unknown[]) => void)(...args);
  }
}
