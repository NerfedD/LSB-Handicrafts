import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/** Reads are invalidated by writes; an earlier snapshot cannot undo a save. */
export default function useSupabaseCollection(col, { enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const revision = useRef(0);
  const epoch = useRef(0);
  const pending = useRef(new Set());
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    const generation = ++epoch.current;
    if (!enabled) {
      queueMicrotask(() => {
        if (epoch.current !== generation) return;
        setRows([]); setIsLoaded(false); setError(null);
      });
      return;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const generation = epoch.current;
    let cancelled = false;
    const readRevision = revision.current;
    (async () => {
      const result = await col.load([]);
      if (cancelled || generation !== epoch.current) return;
      if (readRevision !== revision.current || pending.current.size) return;
      if (!result.ok) {
        setError(result.error || new Error('Could not reach the database.'));
        toast.error('Could not refresh the records. Check your connection and try again.');
        return;
      }
      setRows(result.data); setIsLoaded(true); setError(null);
    })();
    const refresh = () => { if (document.visibilityState === 'visible' && !pending.current.size) reload(); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { cancelled = true; window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [col, enabled, reloadToken, reload]);

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
  const replaceRows = useCallback((next) => { revision.current += 1; setRows(next); }, []);
  return { rows: enabled ? rows : [], isLoaded: enabled && isLoaded, error, create, update, remove, reload, setRows: replaceRows };
}
