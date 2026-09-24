import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * How often an on-screen collection is re-read, and how old a copy may be before
 * returning to the window or to a screen triggers a fresh read. Changes made on
 * this device show immediately; these only bound how long a change made on
 * another device takes to appear.
 */
export const REFRESH_MS = 60_000;
export const STALE_MS = 30_000;

/**
 * ONE timer and ONE focus listener for every collection. Each collection used
 * to own a 30-second interval and a focus handler, so fifteen tables were
 * re-read every half minute and all fifteen at once whenever the window was
 * focused. Collections subscribe only while a screen needs them.
 */
const listeners = new Set();
let timer = null;
const onFocus = () => listeners.forEach((listener) => listener('focus'));
const onVisibility = () => document.visibilityState === 'visible' && onFocus();

/**
 * Joins the shared refresh: `listener('tick')` once a minute while the page is
 * visible, `listener('focus')` when the window comes back. Returns the unsubscribe.
 * For data that is not a collection -- the staff list App keeps itself.
 */
export function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') listeners.forEach((l) => l('tick'));
    }, REFRESH_MS);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

/**
 * Rows of one collection, kept in step with the database.
 *
 * `enabled` is "signed in": turning it off forgets the rows. `active` is "a
 * screen needs these now": until it first turns on nothing is read, and while
 * it is off the rows are kept but not refreshed. `params` narrows the read
 * (see the collection's `refine`); changing them re-reads.
 *
 * A re-read that returns exactly what is already held changes nothing, so an
 * idle screen is not re-rendered every minute. Reads are invalidated by writes:
 * an older snapshot cannot undo a save.
 */
export default function useSupabaseCollection(col, { enabled = true, active = true, params } = {}) {
  const [rows, setRows] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // The params the rows on hand were read with. Differs from the current ones
  // while a re-read for new params (an older record asked for) is in flight.
  const [loadedKey, setLoadedKey] = useState(null);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const revision = useRef(0);
  const epoch = useRef(0);
  const pending = useRef(new Set());
  const loadedAt = useRef(0);
  const readToken = useRef(0);
  const signature = useRef(null);
  const paramsKey = JSON.stringify(params ?? null);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    const generation = ++epoch.current;
    if (enabled) return;
    loadedAt.current = 0;
    signature.current = null;
    queueMicrotask(() => {
      if (epoch.current !== generation) return;
      setRows([]); setIsLoaded(false); setError(null);
    });
  }, [enabled]);

  // Anything already held is stale for new parameters.
  useEffect(() => { loadedAt.current = 0; }, [paramsKey]);

  useEffect(() => {
    if (!enabled || !active) return;
    let cancelled = false;
    const read = async () => {
      const generation = epoch.current;
      const readRevision = revision.current;
      const result = await col.load(JSON.parse(paramsKey) ?? undefined);
      if (cancelled || generation !== epoch.current) return;
      if (readRevision !== revision.current || pending.current.size) return;
      if (!result.ok) {
        setError(result.error || new Error('Could not reach the database.'));
        toast.error('Could not refresh the records. Check your connection and try again.');
        return;
      }
      loadedAt.current = Date.now();
      setError(null);
      setIsLoaded(true);
      setLoadedKey(paramsKey);
      const next = JSON.stringify(result.data);
      if (next === signature.current) return;
      signature.current = next;
      setRows(result.data);
    };
    // Read on an explicit reload, or when what is held has gone stale -- not
    // merely because a screen that needs these was opened again.
    if (reloadToken !== readToken.current || Date.now() - loadedAt.current > STALE_MS) {
      readToken.current = reloadToken;
      read();
    }
    const unsubscribe = subscribe((why) => {
      if (pending.current.size) return;
      if (why === 'tick' || Date.now() - loadedAt.current > STALE_MS) reload();
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [col, enabled, active, paramsKey, reloadToken, reload]);

  const mutate = useCallback(async (method, id, payload) => {
    if (!enabled) return { ok: false, message: 'Please sign in again.' };
    const key = id ?? payload?.id;
    if (pending.current.has(key)) return { ok: false, message: 'This record is already being saved.' };
    pending.current.add(key);
    revision.current += 1;
    const generation = epoch.current;
    try {
      const result = await (method === 'create' ? col.create(payload) : col[method](id, payload));
      if (generation !== epoch.current) return { ok: false, message: 'The session changed. Reload to check the saved record.' };
      if (result.ok) {
        const saved = result.data ? col.fromRow(result.data) : payload;
        signature.current = null;
        setRows((prev) => method === 'remove' ? prev.filter((row) => row.id !== id)
          : method === 'create' ? [...prev.filter((row) => row.id !== saved.id), saved]
          : prev.map((row) => row.id === id ? { ...row, ...saved } : row));
      }
      return result;
    } catch (cause) {
      return { ok: false, error: cause, message: 'The request failed. Check your connection and retry.' };
    } finally {
      pending.current.delete(key);
      revision.current += 1;
      if (generation === epoch.current && !pending.current.size) reload();
    }
  }, [col, enabled, reload]);
  const create = useCallback((row) => mutate('create', null, row), [mutate]);
  const update = useCallback((id, patch) => mutate('update', id, patch), [mutate]);
  const remove = useCallback((id) => mutate('remove', id), [mutate]);
  const replaceRows = useCallback((next) => {
    revision.current += 1;
    signature.current = null;
    setRows(next);
  }, []);
  return {
    rows: enabled ? rows : [],
    isLoaded: enabled && isLoaded,
    settled: enabled && isLoaded && loadedKey === paramsKey,
    error,
    create,
    update,
    remove,
    reload,
    setRows: replaceRows,
  };
}
