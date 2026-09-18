import { describe, expect, it } from 'vitest';
import { availableMaterial, completionCounts, countValue, freeMaterial, materialShortfall, pluralUnit, productionTotals, receiptCounts, recipeEstimate, units } from './production';

describe('supplier and production counts', () => {
  it('accepts 48 usable sheets and flags 2 transit losses', () => {
    expect(receiptCounts(50, '50', '2')).toEqual({ usable: 48, short: 0, extra: 0, claim: true });
    expect(receiptCounts(50, '47', '0')).toMatchObject({ short: 3, claim: true });
    expect(receiptCounts(50, '51', '0')).toMatchObject({ extra: 1, claim: true });
  });
  it('rejects invalid counts without clamping or silently rounding them', () => {
    for (const n of ['', null, undefined, -1, 0.5, Infinity, 2_000_000_001]) expect(countValue(n)).toBeNull();
    expect(receiptCounts(50, '2', '3')).toBeNull();
    expect(completionCounts('100', '101')).toBeNull();
  });
  it('distinguishes individual pieces from selling packs', () => {
    expect(completionCounts(100, 5)).toMatchObject({ good: 95, shelfUnits: 95, yield: 95 });
    expect(completionCounts(100, 5, 5)).toMatchObject({ shelfUnits: 19, wholePacks: true });
    expect(completionCounts(100, 4, 5).wholePacks).toBe(false);
    expect(completionCounts(0, 0).yield).toBe(0);
  });
  it('reserves material for open batches and releases cancelled allocations', () => {
    const batches = [{ id: 1, raw_material_id: 10, status: 'Queued', raw_material_used_qty: 45 }, { id: 2, raw_material_id: 10, status: 'Cancelled', raw_material_used_qty: 50 }];
    expect(availableMaterial({ id: 10, stock: 48 }, batches)).toBe(3);
    expect(availableMaterial({ id: 10, stock: 48 }, batches, 1)).toBe(48);
  });
  it('rounds recipe estimates up and calculates weighted yield', () => {
    expect(recipeEstimate({ material_qty: 45, output_qty: 100 }, 101)).toBe(46);
    expect(productionTotals([{ status: 'Completed', good_output_qty: 95, damaged_qty: 5 }, { status: 'Completed', good_output_qty: 5, damaged_qty: 5 }])).toMatchObject({ total: 110, good: 100, damaged: 10, yield: 100 / 110 * 100 });
    expect(productionTotals([]).yield).toBeNull();
  });
  it('states a shortfall in words rather than showing a negative count', () => {
    const over = [{ id: 1, raw_material_id: 10, status: 'Queued', raw_material_used_qty: 55 }];
    const material = { id: 10, stock: 48 };
    // The signed figure is what validation compares against, so it stays signed.
    expect(availableMaterial(material, over)).toBe(-7);
    // What a screen prints never goes below zero.
    expect(freeMaterial(material, over)).toBe(0);
    expect(materialShortfall(material, over)).toBe(7);
    expect(materialShortfall(material, [])).toBe(0);
  });
  it('pluralises a unit typed by a manager without mangling it', () => {
    expect(units(1, 'sheet')).toBe('1 sheet');
    expect(units(48, 'sheet')).toBe('48 sheets');
    expect(units(0, 'sheet')).toBe('0 sheets');
    expect(pluralUnit('box', 2)).toBe('boxes');
    expect(pluralUnit('bundle', 2)).toBe('bundles');
    // Already plural, or already an abbreviation, is left exactly as typed.
    expect(pluralUnit('pcs', 2)).toBe('pcs');
    expect(units(2, '')).toBe('2 units');
  });
});
