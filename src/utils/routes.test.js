import { describe, expect, it } from 'vitest';
import { readRoute, routePath } from './routes';

describe('URL routes', () => {
  it.each([
    ['/products/42/edit', 'product-form', 42],
    ['/orders/1041', 'order-detail', 1041],
    ['/orders/1041/edit', 'order-edit', 1041],
    ['/staff/3/role', 'assign-role', 3],
    ['/customers/7', 'customer-detail', 7],
    ['/suppliers/9', 'supplier-detail', 9],
    ['/raw-materials/701', 'raw-material-detail', 701],
    ['/deliveries/4', 'delivery-detail', 4],
    ['/products/new', 'product-form', null],
    ['/orders/new', 'order-form', null],
    ['/dashboard', 'dashboard', null],
  ])('round trips %s without losing its record', (pathname, view, id) => {
    expect(readRoute({ pathname })).toMatchObject({ view, id });
    expect(routePath(view, id)).toBe(pathname);
  });
  it.each(['/products/nope', '/products/new/extra', '/orders/1/edit/extra', '/staff/2/edit', '/not-a-view'])('rejects invalid path %s', (pathname) => {
    expect(readRoute({ pathname }).view).toBe('not-found');
  });
});
