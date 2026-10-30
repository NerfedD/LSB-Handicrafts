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
// Screens My profile took over when it began editing in place. An old bookmark
// lands on the profile rather than on "page not found".
const RETIRED_VIEWS = { 'profile-edit': 'profile', 'change-password': 'profile' };
/** The dialog each section's /new path opens. */
export const NEW_DIALOGS = { products: 'add-product', orders: 'new-order' };
// Screens that exist only as part of a section's record routes.
const INTERNAL_VIEWS = new Set([...Object.keys(RECORD_KEYS), 'order-form']);
const sections = { products: 'product', orders: 'order', customers: 'customer',
  suppliers: 'supplier', deliveries: 'delivery', staff: 'account', 'raw-materials': 'raw-material' };

export function readRoute(location) {
  const parts = location.pathname.split('/').filter(Boolean);
  let view = parts[0] || 'dashboard';
  if (parts.length === 1 && RETIRED_VIEWS[view]) view = RETIRED_VIEWS[view];
  let id = null;
  if (sections[view] && parts[1]) {
    const section = view;
    if (parts[1] === 'new' && ['products', 'orders'].includes(section)) {
      // Adding is a dialog over the list now, so /products/new and
      // /orders/new open the list with that dialog up.
      if (parts.length !== 2) view = 'not-found';
      else return { view: section, id: null, record: undefined, dialog: NEW_DIALOGS[section] };
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
  } else if (parts.length > 1 || INTERNAL_VIEWS.has(view)) {
    // A top-level screen is exactly one segment, and the detail and form
    // screens are reached through their section (/orders/12), never by their
    // internal name (/order-detail). Anything else is a path nobody wrote.
    view = 'not-found';
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
