import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface Options {
  /** Postgres table in the `public` schema. It must also be in the `supabase_realtime` publication. */
  table: string;
  /** Defaults to all events. */
  event?: Event;
  /** Server-side filter, e.g. `status=eq.pending`. */
  filter?: string;
  /** Collapse bursts (bulk updates fire one event per row) into a single call. */
  debounceMs?: number;
  /** Skip subscribing entirely — for gating on `isAdmin`, since RLS would drop the events anyway. */
  enabled?: boolean;
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

/**
 * Subscribes to Postgres changes on one table and calls `onChange`.
 *
 * Realtime evaluates the table's RLS SELECT policy per subscriber, so an admin-only
 * table delivers nothing to storefront visitors even though they share the anon key.
 * The callback is held in a ref so callers don't have to memoize it — only the
 * subscription options resubscribe the channel.
 */
export function useRealtimeTable({
  table,
  event = '*',
  filter,
  debounceMs = 0,
  enabled = true,
  onChange,
}: Options) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    // `event` is a runtime-chosen union, but `.on`'s overloads each expect a single
    // literal (so the payload type can narrow to Insert/Update/Delete) — cast past
    // that here since our callback takes the general `RealtimePostgresChangesPayload`.
    const channel = supabase
      .channel(`realtime:${table}:${event}:${filter ?? 'all'}`)
      .on(
        'postgres_changes' as 'system',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) } as never,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (debounceMs <= 0) {
            onChangeRef.current(payload);
            return;
          }
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => onChangeRef.current(payload), debounceMs);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [table, event, filter, debounceMs, enabled]);
}
