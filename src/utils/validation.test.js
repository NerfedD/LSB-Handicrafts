import { afterEach, describe, expect, it, vi } from 'vitest';

import { codeProblem, countProblem, measureProblem, moneyProblem, nameProblem, tidyLabel, unitProblem, wholeNumber } from './validation';
import { localDateIso, promisedDateProblem } from './dates';

describe('counts', () => {
  it('takes a whole number as typed, without decimals', () => {
    expect(countProblem('12', { label: 'The count' })).toBeNull();
    expect(countProblem(' 0 ', { label: 'The count' })).toBeNull();
    expect(wholeNumber('40')).toBe(40);
  });

  it('refuses fractions, negatives, blanks and anything below the minimum', () => {
    expect(countProblem('1.5', { label: 'The count' })).toMatch(/whole number/);
    expect(countProblem('-3', { label: 'The count' })).toMatch(/whole number/);
    expect(countProblem('', { label: 'The count' })).toMatch(/is needed/);
    expect(countProblem('0', { min: 1, label: 'The quantity' })).toBe('The quantity must be at least 1.');
    expect(countProblem('11', { max: 10, label: 'The number' })).toMatch(/10 or less/);
    expect(wholeNumber('2.0')).toBeNull();
  });
});

describe('measurements and money', () => {
  it('accepts whole numbers and decimals above zero, and a blank optional value', () => {
    for (const ok of ['30', '0.5', '.5', '12.125', '']) {
      expect(measureProblem(ok, { label: 'The density', max: 25000, unit: 'kg/m³' }), ok).toBeNull();
    }
  });

  it('refuses zero, negatives, too many decimals and values past the limit', () => {
    const check = { label: 'The length', max: 200, unit: 'feet' };
    expect(measureProblem('0', check)).toBe('The length must be more than 0.');
    expect(measureProblem('-4', check)).toBe('The length must be a number above 0.');
    expect(measureProblem('1.2345', check)).toMatch(/3 decimal places/);
    expect(measureProblem('201', check)).toBe('The length must be no more than 200 feet.');
  });

  it('takes a price without ".00", and refuses a third decimal place', () => {
    expect(moneyProblem('120')).toBeNull();
    expect(moneyProblem('0')).toBeNull();
    expect(moneyProblem('120.5')).toBeNull();
    expect(moneyProblem('12.345')).toMatch(/2 decimal places/);
    expect(moneyProblem('-1')).toMatch(/0 or more/);
    expect(moneyProblem('')).toMatch(/needed/);
  });
});

describe('codes, units and names', () => {
  it('accepts the code format in either case and refuses anything else', () => {
    for (const ok of ['SS-100-4X8', 'ss-100-4x8', 'RM-SHT-001', 'AB', '']) expect(codeProblem(ok), ok).toBeNull();
    for (const bad of ['A', 'SS_100', 'SS--100', '-SS', 'SS-', 'SS 100', 'SS/100', `${'A'.repeat(41)}`]) {
      expect(codeProblem(bad), bad).toMatch(/letters, numbers and single hyphens/);
    }
  });

  it('keeps a unit to letters and single spaces, in any case', () => {
    for (const ok of ['sheet', 'Roll', ' kg ', 'square meter']) expect(unitProblem(ok), ok).toBeNull();
    for (const bad of ['bottle!', 'pcs.', '2kg', '']) expect(unitProblem(bad), bad).not.toBeNull();
  });

  it('allows any punctuation in a name, and folds spaces', () => {
    expect(nameProblem('Styro sheet 1/2" × 4ft (high-density), grade A&B')).toBeNull();
    expect(nameProblem('   ')).toMatch(/needed/);
    expect(nameProblem('x'.repeat(201))).toMatch(/200 characters/);
    expect(tidyLabel('  styro   BALLS ')).toBe('styro BALLS');
  });
});

describe('promised dates', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the local calendar day, not the UTC one', () => {
    vi.useFakeTimers();
    // 7am on 30 September in Manila is still 29 September in UTC.
    vi.setSystemTime(new Date(2026, 8, 30, 7, 0, 0));
    expect(localDateIso()).toBe('2026-09-30');
  });

  it('refuses a date before today, but leaves a date already on the record alone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));
    expect(promisedDateProblem('2026-09-30')).toBeNull();
    expect(promisedDateProblem('2026-10-02')).toBeNull();
    expect(promisedDateProblem('')).toBeNull();
    expect(promisedDateProblem('2026-09-29')).toMatch(/already passed/);
    expect(promisedDateProblem('2026-09-01', '2026-09-01')).toBeNull();
    expect(promisedDateProblem('2026-09-02', '2026-09-01')).toMatch(/already passed/);
  });
});
