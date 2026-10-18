/**
 * Pesos are whole centavos. Plain float arithmetic is not: 0.1 + 0.2 is
 * 0.30000000000000004 and 6 * 19.99 is 119.94000000000001, and the database
 * compares refund amounts as exact numerics, so a stray fraction of a centavo
 * is enough for it to refuse a refund. Round every peso sum or product here.
 */
export const roundMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
