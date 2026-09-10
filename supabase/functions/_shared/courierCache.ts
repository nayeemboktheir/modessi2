// Cross-worker cache for paid courier lookups.
//
// The self-hosted router spawns a new user worker per request, so a module-level Map
// is empty on arrival every time — the previous in-memory caches never once served a
// hit in production. These helpers persist to `courier_lookup_cache` instead, which
// is what actually stops the BDCourier bill from scaling with page views.
//
// Every call is best-effort: a cache failure must never take down the lookup itself.

// deno-lint-ignore no-explicit-any
type SupabaseClient = { from: (table: string) => any };

const TABLE = 'courier_lookup_cache';

export async function readCache<T>(
  supabase: SupabaseClient,
  cacheKey: string,
  ttlMs: number,
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('payload, fetched_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (error) {
      console.error('Cache read failed:', error.message);
      return null;
    }
    if (!data) return null;

    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > ttlMs) return null;

    return data.payload as T;
  } catch (err) {
    console.error('Cache read threw:', err);
    return null;
  }
}

export async function writeCache(
  supabase: SupabaseClient,
  cacheKey: string,
  payload: unknown,
): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { cache_key: cacheKey, payload, fetched_at: new Date().toISOString() },
        { onConflict: 'cache_key' },
      );

    if (error) console.error('Cache write failed:', error.message);
  } catch (err) {
    console.error('Cache write threw:', err);
  }
}
