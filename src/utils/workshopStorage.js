import { loadAllRows } from './storageManager';

/**
 * The purchasing and production tables. Read-only from the browser: every
 * change goes through workshop_command (see utils/commands.js), so rows are
 * used as the database returns them. Loaded only while a screen needs them.
 */
function workshopCollection(table) {
  return {
    table,
    fromRow: (row) => row,
    async load() {
      try {
        return { ok: true, data: await loadAllRows(table) };
      } catch (error) {
        return { ok: false, error, data: [] };
      }
    },
  };
}

export const rawMaterialsCollection = workshopCollection('raw_materials');
export const rawMaterialOrdersCollection = workshopCollection('raw_material_orders');
export const productionBatchesCollection = workshopCollection('production_batches');
export const productionRecipesCollection = workshopCollection('production_recipes');
export const productionDefectsCollection = workshopCollection('production_defect_logs');
export const materialLotsCollection = workshopCollection('raw_material_lots');
export const materialUsageCollection = workshopCollection('production_material_usage');
