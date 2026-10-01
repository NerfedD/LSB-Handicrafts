import { expect, it } from 'vitest';
import { codeProblem, countProblem, measureProblem, moneyProblem, nameProblem, unitProblem } from './validation';
import { photoFileProblem } from './photos';

it('VAL-money: exact upper bound and cent precision, whitespace and malformed text', () => {
  for (const value of ['0', '0.01', ' 100000000.00 ']) expect(moneyProblem(value), value).toBeNull();
  for (const value of [' ', '-0.01', '100000000.01', '1.001', '1e2', 'NaN', '12x']) expect(moneyProblem(value), value).not.toBeNull();
});
it('VAL-sizes: exact 240-inch and 200-foot limits, just above and zero', () => {
  for (const [max, unit] of [[240, 'inches'], [200, 'feet']]) {
    const check = { max, unit, label: 'Size' };
    expect(measureProblem(String(max), check)).toBeNull();
    expect(measureProblem(String(max + 0.001), check)).not.toBeNull();
    for (const value of ['0', '-1', '1.0001', '1e2']) expect(measureProblem(value, check)).not.toBeNull();
  }
});
it('VAL-counts: maximum whole count and just beyond, fractions, blanks and malformed text', () => {
  expect(countProblem('2000000000')).toBeNull();
  for (const value of ['2000000001', '2.0', '1.5', '-1', ' ', '1e2', 'NaN']) expect(countProblem(value), value).not.toBeNull();
});
it('VAL-labels: code 2/40/41, unit 24/25 and name 200/201 boundaries', () => {
  expect(codeProblem('AB')).toBeNull(); expect(codeProblem('A'.repeat(40))).toBeNull();
  expect(codeProblem('A')).not.toBeNull(); expect(codeProblem('A'.repeat(41))).not.toBeNull();
  expect(unitProblem('a'.repeat(24))).toBeNull(); expect(unitProblem('a'.repeat(25))).not.toBeNull();
  expect(nameProblem('a'.repeat(200))).toBeNull(); expect(nameProblem('a'.repeat(201))).not.toBeNull();
});
it('VAL-photos: allowed types, exact 15 MiB boundary, larger and script-like MIME types', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(photoFileProblem({ type, size: 15 * 1024 * 1024 })).toBeNull();
  expect(photoFileProblem({ type: 'image/jpeg', size: 15 * 1024 * 1024 + 1 })).toMatch(/larger/);
  for (const type of ['image/svg+xml', 'text/html', 'application/javascript']) expect(photoFileProblem({ type, size: 10 })).toMatch(/JPEG, PNG or WebP/);
});
