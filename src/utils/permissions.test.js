import { describe, expect, it } from 'vitest';

import { can, canAccess, CAPABILITIES } from './permissions';
import { collectionsFor } from './screenData';

const ROLES = ['Admin', 'Manager', 'Sales Staff', 'Production Staff', 'Delivery Staff'];
const allowed = (capability) => ROLES.filter((role) => can(role, capability));

/**
 * The screens' half of the permission rules. The database enforces the same
 * lists (schema.sql; permissionsDatabase.test.js); these pin the browser to
 * them so a hidden button and a refused write cannot drift apart.
 */
describe('who may do what', () => {
  it('keeps money, catalogue, stock corrections and suppliers with managers and admins', () => {
    for (const capability of ['handleMoney', 'manageCatalogue', 'correctStock', 'manageSuppliers', 'manageLoyalty', 'viewReports']) {
      expect(allowed(capability), capability).toEqual(['Admin', 'Manager']);
    }
  });

  it('lets the people who handle stock record damage', () => {
    expect(allowed('recordDamage')).toEqual(['Admin', 'Manager', 'Production Staff']);
  });

  it('shows customer contact details only to the roles that sell and deliver', () => {
    expect(allowed('viewCustomers')).toEqual(['Admin', 'Manager', 'Sales Staff', 'Delivery Staff']);
    expect(allowed('editCustomers')).toEqual(['Admin', 'Manager', 'Sales Staff']);
  });

  it('keeps removal and staff administration with the administrator', () => {
    expect(allowed('removeRecords')).toEqual(['Admin']);
    expect(allowed('manageStaff')).toEqual(['Admin']);
  });

  it('refuses an unknown role everything', () => {
    for (const capability of Object.keys(CAPABILITIES)) expect(can(null, capability)).toBe(false);
  });
});

describe('screen access', () => {
  it('opens the product form and the order editor only to managers and admins', () => {
    for (const role of ROLES) {
      const manager = role === 'Admin' || role === 'Manager';
      expect(canAccess(role, 'product-form'), role).toBe(manager);
      expect(canAccess(role, 'order-edit'), role).toBe(manager);
      expect(canAccess(role, 'products'), role).toBe(true);
    }
  });

  it('keeps production staff out of the customer screens', () => {
    expect(canAccess('Production Staff', 'customers')).toBe(false);
    expect(canAccess('Delivery Staff', 'customers')).toBe(true);
  });
});

describe('what each screen reads', () => {
  it('reads the workshop tables only on workshop screens', () => {
    expect(collectionsFor('orders', { role: 'Admin' }).has('batches')).toBe(false);
    expect(collectionsFor('production', { role: 'Admin' }).has('lots')).toBe(true);
  });

  it('does not ask for customers on behalf of a role that cannot see them', () => {
    expect([...collectionsFor('dashboard', { role: 'Production Staff' })]).not.toContain('customers');
    expect([...collectionsFor('dashboard', { role: 'Sales Staff' })]).toContain('customers');
  });

  it('adds what an open dialog needs', () => {
    expect(collectionsFor('orders', { role: 'Admin', open: ['suppliers'] }).has('suppliers')).toBe(true);
  });
});
