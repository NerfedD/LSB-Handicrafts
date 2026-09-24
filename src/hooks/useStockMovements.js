import { useEffect, useState } from 'react';

import { fetchStockMovements } from '../utils/storageManager';

/**
 * One product's or raw material's stock history, newest first -- read for the
 * record on screen only, and again whenever its count changes (`balance`), so
 * a movement just recorded appears without a reload.
 */
export default function useStockMovements({ inventoryId = null, rawMaterialId = null, balance }) {
  const [state, setState] = useState({ key: null, rows: [], error: null });
  const key = `${inventoryId}:${rawMaterialId}:${balance}`;

  useEffect(() => {
    if (inventoryId == null && rawMaterialId == null) return undefined;
    let cancelled = false;
    fetchStockMovements({ inventoryId, rawMaterialId }).then((result) => {
      if (!cancelled) setState({ key, rows: result.data, error: result.ok ? null : result.error });
    });
    return () => { cancelled = true; };
  }, [inventoryId, rawMaterialId, key]);

  return { rows: state.rows, error: state.error, isLoaded: state.key === key };
}
