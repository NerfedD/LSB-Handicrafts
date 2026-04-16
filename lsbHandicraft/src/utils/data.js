export const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 45.00, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 85.00, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180.00, stock: 10, status: 'Low Stock' },
  { id: 4, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 125.00, stock: 200, status: 'In Stock' },
];

export const initialDeliveries = [
  { id: 1, product: 'Styro Ball 4 inch', size: '4 inch', location: 'Digos City', status: 'Not Yet Delivered', createdAt: 'Apr 10, 2026' },
  { id: 2, product: 'Styro Sheet 1/2 inch', size: '1/2 inch', location: 'General Santos', status: 'On The Way', createdAt: 'Apr 10, 2026' },
];
