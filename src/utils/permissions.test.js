import { describe, expect, it } from 'vitest';

import { can, canAccess, CAPABILITIES } from './permissions';
import { collectionsFor } from './screenData';
import { NAV_TREE, SECTION_OF } from './navigation';

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

  it('keeps the production report with managers, as a tab of Production', () => {
    for (const role of ROLES) {
      expect(canAccess(role, 'production-report'), role).toBe(role === 'Admin' || role === 'Manager');
    }
    expect(canAccess('Production Staff', 'production')).toBe(true);
    expect(canAccess('Sales Staff', 'production')).toBe(false);
    expect(SECTION_OF['production-report']).toBe('production');
  });

  it('gives purchasing, raw materials, production and products a sidebar entry each', () => {
    const entry = (view) => NAV_TREE.find((item) => item.views[0] === view);
    expect(entry('raw-material-orders')?.label).toBe('Purchasing');
    expect(entry('raw-materials')?.label).toBe('Raw materials');
    expect(entry('production')?.label).toBe('Production');
    expect(entry('products')?.label).toBe('Products & stock');
    // Anyone may receive a supplier delivery, so everyone can open Purchasing.
    for (const role of ROLES) expect(canAccess(role, 'raw-material-orders'), role).toBe(true);
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
