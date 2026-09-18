export const MAX_COUNT = 2_000_000_000;

/**
 * "48 sheets", "1 sheet", "6 bottles".
 *
 * A material's unit is free text a manager types once ("sheet", "block",
 * "bottle", "roll"), so it cannot be pluralised from a fixed table. Screens
 * printed the stored word unchanged instead, which read as "48 sheet on hand"
 * and "1 claims need review" on the same product. The rules below cover the
 * endings those words actually take; anything already ending in "s" is left
 * alone, so a unit typed as "pcs" does not become "pcss".
 */
export function pluralUnit(word, count) {
  const unit = String(word || 'unit').trim();
  if (Number(count) === 1 || !unit || /s$/i.test(unit)) return unit;
  if (/(x|z|ch|sh)$/i.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

/** The same, with the count in front: the form every screen actually needs. */
export const units = (count, unit) => `${count} ${pluralUnit(unit, count)}`;

export const activeBatch = (batch) => ['Queued', 'In Progress', 'Quality Check'].includes(batch.status);
/**
 * What is left after every unfinished batch has taken its share.
 *
 * CLAMPED AT ZERO FOR DISPLAY IS NOT THE SAME AS CLAMPED HERE. Queued batches
 * can legitimately reserve more than is on the shelf — that is precisely the
 * shortfall a manager needs to see — so this still returns the true signed
 * figure and the form validation still compares against it. Screens call
 * `materialShortfall` below rather than printing "-7 available", which reads
 * as a bug rather than as "seven short".
 */
export function availableMaterial(material, batches = [], exceptId) {
  return (material?.stock || 0) - batches.filter((b) => b.raw_material_id === material?.id && b.id !== exceptId && activeBatch(b))
    .reduce((sum, b) => sum + b.raw_material_used_qty, 0);
}

/** 0 when the material covers its batches, otherwise how many units short. */
export const materialShortfall = (material, batches, exceptId) =>
  Math.max(0, -availableMaterial(material, batches, exceptId));

/** Never negative: what a worker can actually take off the shelf today. */
export const freeMaterial = (material, batches, exceptId) =>
  Math.max(0, availableMaterial(material, batches, exceptId));
export function countValue(value, minimum = 0) {
  const n = Number(value);
  return value !== '' && value !== null && value !== undefined && Number.isInteger(n) && n >= minimum && n <= MAX_COUNT ? n : null;
}
export function receiptCounts(ordered, arrived, damaged) {
  const total = countValue(arrived), loss = countValue(damaged);
  if (total === null || loss === null || loss > total) return null;
  return { usable: total - loss, short: Math.max(0, ordered - total), extra: Math.max(0, total - ordered), claim: total !== ordered || loss > 0 };
}
export function completionCounts(produced, damaged, packSize = 1) {
  const total = countValue(produced), loss = countValue(damaged);
  if (total === null || loss === null || loss > total) return null;
  const good = total - loss, size = Math.max(1, Number(packSize) || 1);
  return { good, shelfUnits: good / size, wholePacks: good % size === 0, yield: total ? good / total * 100 : 0 };
}
export function recipeEstimate(recipe, pieces) {
  return recipe && countValue(pieces, 1) !== null ? Math.ceil(Number(pieces) * recipe.material_qty / recipe.output_qty) : '';
}
export function productionTotals(batches) {
  const completed = batches.filter((b) => b.status === 'Completed');
  const good = completed.reduce((n, b) => n + b.good_output_qty, 0);
  const damaged = completed.reduce((n, b) => n + b.damaged_qty, 0);
  const total = good + damaged;
  return { good, damaged, total, yield: total ? good / total * 100 : null, damageRate: total ? damaged / total * 100 : null };
}
