import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads a Supabase-backed collection and mutates it one row at a time.
 *
 * WHAT CHANGED AND WHY
 * This hook used to hold the rows in state and persist the WHOLE array back to
 * Supabase whenever its identity changed, via a reconciling upsert that also
 * deleted any row missing from memory. That effect was the single biggest
 * source of the bugs found in class testing:
 *
 *   - A read denied by RLS came back empty. The app appended one row to that
 *     emptiness, and the sync deleted every other row in the table. That is how
 *     the staff table was wiped, and how the owner account disappeared.
 *   - Nothing awaited the write or looked at its result, so a rejected save
 *     still rendered "saved successfully".
 *   - Editing one field re-uploaded every row in the table.
 *
 * So the effect is gone. Callers now mutate through `create`, `update` and
 * `remove`, each of which touches exactly one row, awaits the result, and only
 * updates local state once the database has confirmed the change. A failure
 * leaves the UI showing what is actually stored.
 *
 * `enabled` gates the read, so a signed-out visitor doesn't pay for table reads
 * they can't see the results of — and, more importantly, so an anonymous read
 * can't be mistaken for real state.
 *
 * @param {{load:Function, create:Function, update:Function, remove:Function}} col
 *   a collection from utils/storageManager (e.g. `customersCollection`)
 * @returns {{rows, isLoaded, error, create, update, remove, reload, setRows}}
 */
export default function useSupabaseCollection(col, { enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  // `col` is a module-level object in practice, but pin it so an inline literal
  // at a call site can't re-trigger the read on every render.
  const colRef = useRef(col);
  useEffect(() => {
    colRef.current = col;
  });

  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    (async () => {
      const result = await colRef.current.load([]);
      if (cancelled) return;
      if (!result.ok) {
        // Leave isLoaded false so the screen can show a retry affordance rather
        // than an empty list. A failed read and an empty table used to be
        // indistinguishable, permanently.
        setError(result.error || new Error("Could not reach the database."));
        return;
      }
      setError(null);
      setRows(result.data);
      setIsLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  const create = useCallback(async (row) => {
    const result = await colRef.current.create(row);
    if (result.ok) {
      // Prefer the row the database returned: it carries server defaults and
      // any value a trigger rewrote.
      const saved = result.data ? colRef.current.fromRow(result.data) : row;
      setRows((prev) => [...prev, saved]);
    }
    return result;
  }, []);

  const update = useCallback(async (id, patch) => {
    const result = await colRef.current.update(id, patch);
    if (result.ok) {
      const saved = result.data ? colRef.current.fromRow(result.data) : patch;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...saved } : r)));
    }
    return result;
  }, []);

  const remove = useCallback(async (id) => {
    const result = await colRef.current.remove(id);
    if (result.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
    return result;
  }, []);

  return { rows, isLoaded, error, create, update, remove, reload, setRows };
}
