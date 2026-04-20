export const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 45.00, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 85.00, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180.00, stock: 10, status: 'Low Stock' },
  { id: 4, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 125.00, stock: 200, status: 'In Stock' },
];

export const initialDeliveries = [
  { id: 1, product: 'Styro Ball 4 inch', size: '4 inch', location: 'Digos City', amount: 50, status: 'Not Yet Delivered', createdAt: 'Apr 10, 2026' },
  { id: 2, product: 'Styro Sheet 1/2 inch', size: '1/2 inch', location: 'General Santos', amount: 100, status: 'On The Way', createdAt: 'Apr 10, 2026' },
  { id: 3, product: 'Order #123456 - Walk-in Customer', size: 'Order Package', location: 'Davao City', amount: 15, status: 'Delivered', createdAt: 'Apr 16, 2026' },
  { id: 4, product: 'Order #654321 - Maria Clara', size: 'Order Package', location: 'Panabo City', amount: 30, status: 'On The Way', createdAt: 'Apr 17, 2026' },
];

export const initialOrders = [
  { 
    id: 1, 
    customerName: 'Juan Dela Cruz', 
    items: [
      { productId: 1, name: 'Styro Ball 2 inch', quantity: 10, price: 45.00 },
      { productId: 2, name: 'Styro Ball 4 inch', quantity: 5, price: 85.00 }
    ], 
    totalAmount: 875.00, 
    status: 'Pending', 
    createdAt: 'Apr 12, 2026' 
  },
  { 
    id: 123456, 
    customerName: 'Walk-in Customer', 
    items: [
      { productId: 3, name: 'Styro Sheet 1 inch', quantity: 15, price: 180.00 }
    ], 
    totalAmount: 2700.00, 
    status: 'Completed', 
    createdAt: 'Apr 16, 2026' 
  },
  { 
    id: 654321, 
    customerName: 'Maria Clara', 
    items: [
      { productId: 4, name: 'Styro Sheet 1/2 inch', quantity: 30, price: 125.00 }
    ], 
    totalAmount: 3750.00, 
    status: 'Pending', 
    createdAt: 'Apr 17, 2026' 
  },
];
