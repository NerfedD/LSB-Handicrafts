import { useEffect, useRef, useState } from "react";

/**
 * Loads a Supabase-backed collection once and keeps it synced on change.
 *
 * This packages the load/persist dance App.jsx already does by hand for
 * `staff` (see the isStaffLoaded / loadedStaffRef guards there), because the
 * customer, product and supplier collections all need exactly the same thing:
 *
 *   - Read once, on mount, and don't block first paint on it.
 *   - Distinguish "the table is empty" from "the read failed". `loadTable`
 *     returns { ok, data } for this reason; a failed read leaves `isLoaded`
 *     false, which disarms the persist effect so it can't sync that emptiness
 *     back up and delete every row.
 *   - Don't write the freshly-read rows straight back. The array identity
 *     check against `loadedRef` tells "just loaded" apart from "actually
 *     edited" — without it every page load costs a SELECT plus a full upsert.
 *
 * `enabled` gates the whole thing, so a signed-out visitor doesn't pay for
 * three table reads they can't see the results of.
 *
 * @returns {[Array, Function, boolean]} [rows, setRows, isLoaded]
 */
export default function useSupabaseCollection(load, save, { enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedRef = useRef(null);

  // `load` and `save` are module-level functions in practice, but pin them in
  // refs anyway so an inline arrow at a call site can't re-trigger the read.
  const loadRef = useRef(load);
  const saveRef = useRef(save);
  useEffect(() => {
    loadRef.current = load;
    saveRef.current = save;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const result = await loadRef.current([]);
      if (cancelled || !result.ok) return;
      loadedRef.current = result.data;
      setRows(result.data);
      setIsLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!isLoaded) return;
    if (rows === loadedRef.current) return;
    saveRef.current(rows);
  }, [rows, isLoaded]);

  return [rows, setRows, isLoaded];
}
