import { ACCOUNT_VIEWS, NAV_TREE } from './navigation';

const views = new Set([...ACCOUNT_VIEWS, ...NAV_TREE.flatMap((item) => item.views),
  'login', 'forgot-password', 'reset-password']);
export const RECORD_KEYS = {
  'raw-material-detail': 'RawMaterial',
  'manage-account': 'Account', 'assign-role': 'Account',
  'customer-detail': 'Customer', 'supplier-detail': 'Supplier',
  'product-detail': 'Product', 'product-form': 'Product',
  'order-detail': 'Order', 'delivery-detail': 'Delivery',
  // Carries an id for the same reason product-form does: without it the path is
  // a bare /order-edit, nothing seeds selectedOrderId on a reload, and the edit
  // screen comes back with an undefined order and a save that silently does
  // nothing.
  'order-edit': 'Order',
};
const sections = { products: 'product', orders: 'order', customers: 'customer',
  suppliers: 'supplier', deliveries: 'delivery', staff: 'account', 'raw-materials': 'raw-material' };

export function readRoute(location) {
  const parts = location.pathname.split('/').filter(Boolean);
  let view = parts[0] || 'dashboard';
  let id = null;
  if (sections[view] && parts[1]) {
    const section = view;
    if (parts[1] === 'new' && ['products', 'orders'].includes(section)) {
      view = parts.length === 2 ? `${sections[section]}-form` : 'not-found';
    } else {
      id = /^\d+$/.test(parts[1]) ? Number(parts[1]) : null;
      view = section === 'staff' ? 'manage-account' : `${sections[section]}-detail`;
      if (parts[2] === 'edit' && section === 'products') view = 'product-form';
      if (parts[2] === 'edit' && section === 'orders') view = 'order-edit';
      if (parts[2] === 'role' && section === 'staff') view = 'assign-role';
      const validAction = (section === 'products' && parts[2] === 'edit')
        || (section === 'orders' && parts[2] === 'edit')
        || (section === 'staff' && parts[2] === 'role');
      if (!id || parts.length > 3 || (parts[2] && !validAction)) view = 'not-found';
    }
  } else if (parts[1]) {
    id = /^\d+$/.test(parts[1]) ? Number(parts[1]) : null;
  }
  if (!views.has(view)) view = 'not-found';
  return { view, id, record: RECORD_KEYS[view] };
}

export function routePath(view, id) {
  for (const [section, noun] of Object.entries(sections)) {
    if (view === `${noun}-detail` || (section === 'staff' && view === 'manage-account')) return `/${section}/${id}`;
  }
  if (view === 'product-form') return id ? `/products/${id}/edit` : '/products/new';
  if (view === 'order-form') return '/orders/new';
  if (view === 'order-edit') return `/orders/${id}/edit`;
  if (view === 'assign-role') return `/staff/${id}/role`;
  return `/${view}`;
}
