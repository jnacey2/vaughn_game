import { useEffect, useRef, useState } from 'react';

/**
 * Turns a changing "event timestamp" into a short-lived boolean pulse. Pass `undefined` when
 * there's no relevant event for this component right now; pass the event's `ts` when there is
 * one. Every time `ts` changes to a new defined value, the hook flips `true` for `durationMs`
 * then back to `false` — used to (re)trigger CSS hit/attack animations without fighting
 * React's key-based reconciliation for board cards.
 */
export function useFlash(ts: number | undefined, durationMs = 450): boolean {
  const [flashing, setFlashing] = useState(false);
  const prevTs = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (ts !== undefined && ts !== prevTs.current) {
      prevTs.current = ts;
      setFlashing(true);
      const timer = setTimeout(() => setFlashing(false), durationMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [ts, durationMs]);

  return flashing;
}
