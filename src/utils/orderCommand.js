import { supabase } from '../lib/supabaseClient';

import { humanizeError } from './storageManager';

/**
 * One order action, one transaction.
 *
 * WHAT THIS REPLACES. Every stock-moving action on an order used to be a loop
 * of separate writes from here: persistStockChanges() sent one PATCH per
 * inventory row, then the order row went separately. A refusal half way through
 * left the earlier rows committed and the order unwritten, so pressing the
 * button again deducted them a second time; two people doing it at once each
 * sent an absolute total worked out from their own snapshot and the later one
 * erased the earlier; and with the shelf list still loading the loop found
 * nothing to write and reported success while the order was stamped done.
 *
 * public.order_command applies the whole thing in one transaction against
 * locked rows. What travels is the DELTA rather than the total -- see deltasOf
 * in stockLedger -- so the database adds the change to whatever the true count
 * is by then instead of overwriting it with a stale one.
 *
 * Shaped exactly like workshopCommand in workshopStorage.js, down to the P0001
 * passthrough: the function raises messages written for a person to read, and
 * this hands them to the toast rather than replacing them with something
 * generic.
 */
export async function orderCommand(action, data, requestId) {
  try {
    const result = await supabase.rpc('order_command', {
      p_action: action,
      p_data: data,
      p_request_id: requestId,
    });
    if (result.error) {
      return {
        ok: false,
        message:
          result.error.code === 'P0001'
            ? result.error.message
            : humanizeError(result.error, 'We could not save this change. Check the details and try again.'),
      };
    }
    if (!result.data) return { ok: false, message: 'No saved record was returned. Please retry.' };
    return { ok: true, data: result.data };
  } catch {
    return {
      ok: false,
      message: 'We could not reach the order records. Nothing was changed; retry when connected.',
    };
  }
}

/**
 * A request key that survives a retry but not a change of mind.
 *
 * The same key replayed returns the answer the first call stored, instead of
 * running again -- which is what makes "press it again because nothing seemed
 * to happen" safe when the response was lost rather than never sent. A DIFFERENT
 * payload under the same key is refused outright, so this must change whenever
 * what is being asked for changes.
 *
 * Same idea as WorkshopForm's, kept here because these actions are fired from
 * buttons rather than from a form that holds its own state.
 */
export const newRequestId = () => crypto.randomUUID();
