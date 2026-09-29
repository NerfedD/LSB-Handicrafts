import { useCallback, useEffect, useState } from 'react';

import { fetchProductImage } from '../utils/storageManager';

/**
 * One product's photo, read for the product on screen only. Photos are not part
 * of the products list the sidebar keeps loaded, so a list of 150 products does
 * not carry 150 pictures on every screen.
 */
export default function useProductImage(productId, version = null) {
  const [state, setState] = useState({ key: null, photo: null, error: null });
  const [token, setToken] = useState(0);
  const key = `${productId}:${version}:${token}`;

  useEffect(() => {
    if (productId == null) return undefined;
    let cancelled = false;
    fetchProductImage(productId).then((result) => {
      if (!cancelled) setState({ key, photo: result.data, error: result.ok ? null : result.error });
    });
    return () => { cancelled = true; };
  }, [productId, key]);

  const reload = useCallback(() => setToken((n) => n + 1), []);
  return {
    photo: productId == null ? null : state.photo,
    error: state.error,
    isLoaded: productId == null || state.key === key,
    reload,
  };
}
