import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asApi, freshDatabase, rpc, signIn, STAFF } from '../test/database';
import { roundMoney } from './money';
import { normalizeItems, orderTotal } from './orderItems';
import { orderNetTotal } from './orders';
import { passwordIsAcceptable, passwordRequirements } from './password';
import { readRoute } from './routes';
import { inventoryCollection } from './storageManager';

// Regression tests for the bugs found in the adversarial QA run
// QA-BUG-20261018-01 (docs/testing-reports/QA-BUG-20261018-01-bughunt.md).

let db;

beforeAll(async () => {
  db = await freshDatabase();
  await db.exec(`
    insert into public.inventory (id, sku, name, category, stock)
    values (101, 'QA-101', 'Regression Sheet', 'Test', 50);
    insert into public.deliveries (id, product, location, status)
    values (201, 'Order #1 - Regression', '88 Magsaysay Ave, Davao City', 'Ready To Go');
    insert into public.orders (id, customer_name, items, total_amount, refunded_amount, refund_history, status)
    values (
      1,
      'Regression Customer',
      '[{"kind":"catalog","productId":101,"name":"Regression Sheet","quantity":4,"stockUnits":4,"unitPrice":25,"lineTotal":100}]'::jsonb,
      100,
      0.10,
      '[{"id":1,"amount":0.10,"reason":"overcharged","method":"cash"}]'::jsonb,
      'Pending'
    );
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('money is kept in whole centavos (BUG-F02)', () => {
  it('roundMoney removes float noise', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(6 * 19.99)).toBe(119.94);
    expect(roundMoney(100.1 - 99.9)).toBe(0.2);
    expect(roundMoney('abc')).toBe(0);
  });

  it('line totals, order totals and net totals are cent-exact', () => {
    const items = normalizeItems([{ kind: 'catalog', productId: 101, name: 'Sheet', quantity: 6, unitPrice: 19.99 }]);
    expect(items[0].lineTotal).toBe(119.94);
    expect(orderTotal([{ quantity: 1, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }])).toBe(0.3);
    expect(orderNetTotal({ totalAmount: 100.1, refundedAmount: 99.9 })).toBe(0.2);
  });

  it('a second refund of 0.20 after 0.10 is accepted by order_command', async () => {
    await signIn(db, 'admin');
    // The same sum the app now makes in issueRefund.
    const refundedAmount = roundMoney(0.1 + 0.2);
    const result = await rpc(db, 'order_command', 'refund', {
      orderId: 1,
      expectedRevision: 0,
      deltas: [],
      order: {
        items: [{ kind: 'catalog', productId: 101, name: 'Regression Sheet', quantity: 4, stockUnits: 4, unitPrice: 25, lineTotal: 100 }],
        status: 'Pending',
        refundedAmount,
        refundHistory: [
          { id: 1, amount: 0.1, reason: 'overcharged', method: 'cash' },
          { id: 2, amount: roundMoney(0.2), reason: 'overcharged', method: 'cash' },
        ],
      },
    });
    expect(Number(result.order.refunded_amount)).toBe(0.3);
  });
});

describe('who can read what (BUG-F03, BUG-F04)', () => {
  it('Production Staff get no delivery rows, so no customer street address', async () => {
    const rows = await asApi(db, 'production', async () => (await db.query('select id, location from public.deliveries')).rows);
    expect(rows).toEqual([]);
  });

  it('Sales, Delivery, Manager and Admin still read deliveries', async () => {
    for (const who of ['admin', 'manager', 'sales', 'delivery']) {
      const rows = await asApi(db, who, async () => (await db.query('select id from public.deliveries where id = 201')).rows);
      expect(rows.length, who).toBe(1);
    }
  });

  it('an administrator cannot block or demote themselves, but can still edit their own phone', async () => {
    const self = STAFF.admin;
    const attempts = [
      `update public.staff set status = 'Blocked' where id = ${self.id}`,
      `update public.staff set role = 'Sales Staff' where id = ${self.id}`,
    ];
    for (const sql of attempts) {
      await asApi(db, 'admin', async () => {
        await expect(db.query(sql)).rejects.toThrow(/cannot change your own role/);
      });
    }
    await asApi(db, 'admin', () => db.query(`update public.staff set contact_number = '09171234503' where id = ${self.id}`));
  });
});

describe('product reorder point (BUG-F05)', () => {
  it('a missing reorder point reaches the shelf row as 50, never 0', () => {
    const row = inventoryCollection.toRow({ sku: 'QA-BUG-08', name: 'Blank Threshold Product', lowStockThreshold: undefined });
    expect(row.low_stock_threshold).toBe(50);
  });
});

describe('forms (BUG-F09)', () => {
  it('the password checklist stops at the 128 characters the account service accepts', () => {
    const tooLong = `Abcdefg1${'a'.repeat(192)}`;
    expect(passwordRequirements(tooLong).every((rule) => rule.met)).toBe(false);
    expect(passwordIsAcceptable(tooLong)).toBe(false);
    expect(passwordIsAcceptable(`Abcdefg1${'a'.repeat(120)}`)).toBe(true);
  });
});

describe('routes (BUG-F11)', () => {
  it('rejects extra segments on a top-level screen and internal screen names', () => {
    for (const pathname of ['/dashboard/extra', '/production/123/extra', '/profile/extra', '/order-detail', '/product-form', '/assign-role']) {
      expect(readRoute({ pathname }).view, pathname).toBe('not-found');
    }
  });

  it('still opens the real screens', () => {
    expect(readRoute({ pathname: '/' }).view).toBe('dashboard');
    expect(readRoute({ pathname: '/activity' }).view).toBe('activity');
    expect(readRoute({ pathname: '/production' }).view).toBe('production');
  });
});
