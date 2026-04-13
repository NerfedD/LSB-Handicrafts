export const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 15, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 30, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 100, stock: 200, status: 'In Stock' },
  { id: 4, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180, stock: 10, status: 'Low Stock' },
];

export const initialDeliveries = [
  { id: 1, product: 'Styro Ball 2 inch', size: '2 inch', location: 'Davao City', status: 'Pending', createdAt: '2024-04-10T10:00:00Z' },
  { id: 2, product: 'Styro Sheet 1/2 inch', size: '1/2 inch', location: 'Tagum City', status: 'In Transit', createdAt: '2024-04-09T14:30:00Z' },
  { id: 3, product: 'Styro Ball 4 inch', size: '4 inch', location: 'Panabo City', status: 'Delivered', createdAt: '2024-04-08T09:15:00Z' },
  { id: 4, product: 'Styro Sheet 1 inch', size: '1 inch', location: 'Davao City', status: 'Pending', createdAt: '2024-04-11T11:45:00Z' },
  { id: 5, product: 'Styro Ball 2 inch', size: '2 inch', location: 'Mati City', status: 'In Transit', createdAt: '2024-04-07T16:20:00Z' },
];

export const stockHistory = [80, 95, 72, 110, 88, 120, 108, 130, 115, 140];
export const volHistory = [280, 310, 295, 340, 360, 375, 358, 390, 370, 410];