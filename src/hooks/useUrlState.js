import { useCallback, useEffect, useState } from 'react';

/** Display preferences live in the URL, never in an entity cache. */
export default function useUrlState(key, fallback, scope) {
  const [value, setValue] = useState(() => (window.location.pathname.split("/")[1] === scope ? new URLSearchParams(window.location.search).get(key) : null) ?? fallback);
  useEffect(() => {
    const restore = () => setValue((window.location.pathname.split("/")[1] === scope ? new URLSearchParams(window.location.search).get(key) : null) ?? fallback);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [key, fallback, scope]);
  const update = useCallback((next) => {
    setValue(next);
    const url = new URL(window.location.href);
    url.searchParams.set(key, next);
    window.history.replaceState(null, '', url);
  }, [key]);
  return [value, update];
}
