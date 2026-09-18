import { supabase } from '../lib/supabaseClient';
import { humanizeError } from './storageManager';

// Read all pages; a workshop history must not disappear at the API row limit.
function workshopCollection(table) {
  return { table, fromRow: (row) => row, async load() {
    try {
      const rows = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await supabase.from(table).select('*').order('id').range(start, start + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      return { ok: true, data: rows };
    } catch (error) { return { ok: false, error, data: [] }; }
  } };
}
export const rawMaterialsCollection = workshopCollection('raw_materials');
export const rawMaterialOrdersCollection = workshopCollection('raw_material_orders');
export const productionBatchesCollection = workshopCollection('production_batches');
export const productionRecipesCollection = workshopCollection('production_recipes');
export const productionDefectsCollection = workshopCollection('production_defect_logs');
export const materialLotsCollection = workshopCollection('raw_material_lots');
export const materialUsageCollection = workshopCollection('production_material_usage');

export async function workshopCommand(action, data, requestId) {
  try {
    const result = await supabase.rpc('workshop_command', { p_action: action, p_data: data, p_request_id: requestId });
    if (result.error) return { ok: false, message: result.error.code === 'P0001' ? result.error.message
      : humanizeError(result.error, 'We could not save this change. Check the details and try again.') };
    if (!result.data) return { ok: false, message: 'No saved record was returned. Please retry.' };
    return { ok: true, data: result.data };
  } catch { return { ok: false, message: 'We could not reach the workshop records. Your entries are still here; retry when connected.' }; }
}
