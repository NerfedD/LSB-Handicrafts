export const initialInventory = [
  { id: 1, sku: 'SB-001', name: 'Styro Ball 2 inch', category: 'Styro Balls', price: 15, stock: 120, status: 'In Stock' },
  { id: 2, sku: 'SB-002', name: 'Styro Ball 4 inch', category: 'Styro Balls', price: 30, stock: 45, status: 'Low Stock' },
  { id: 3, sku: 'SS-001', name: 'Styro Sheet 1/2 inch', category: 'Styro Sheets', price: 100, stock: 200, status: 'In Stock' },
  { id: 4, sku: 'SS-002', name: 'Styro Sheet 1 inch', category: 'Styro Sheets', price: 180, stock: 10, status: 'Low Stock' },
];

export const initialOrders = [
  {
    id: 1,
    customerName: 'Maria Santos',
    customerContact: '09123456789',
    items: [
      { productId: 1, name: 'Styro Ball 2 inch', price: 15, quantity: 10 },
      { productId: 2, name: 'Styro Ball 4 inch', price: 30, quantity: 5 }
    ],
    total: 300,
    status: 'Completed',
    createdAt: '2024-04-12T09:00:00Z'
  },
  {
    id: 2,
    customerName: 'Juan Dela Cruz',
    customerContact: '09987654321',
    items: [
      { productId: 3, name: 'Styro Sheet 1/2 inch', price: 100, quantity: 2 },
      { productId: 4, name: 'Styro Sheet 1 inch', price: 180, quantity: 1 }
    ],
    total: 380,
    status: 'Processing',
    createdAt: '2024-04-13T14:30:00Z'
  },
  {
    id: 3,
    customerName: 'Ana Reyes',
    customerContact: '09112233445',
    items: [
      { productId: 1, name: 'Styro Ball 2 inch', price: 15, quantity: 20 }
    ],
    total: 300,
    status: 'Pending',
    createdAt: '2024-04-14T11:15:00Z'
  },
  {
    id: 4,
    customerName: 'Pedro Garcia',
    customerContact: '09988776655',
    items: [
      { productId: 2, name: 'Styro Ball 4 inch', price: 30, quantity: 8 },
      { productId: 3, name: 'Styro Sheet 1/2 inch', price: 100, quantity: 1 }
    ],
    total: 340,
    status: 'Completed',
    createdAt: '2024-04-11T16:45:00Z'
  },
  {
    id: 5,
    customerName: 'Rosa Mendoza',
    customerContact: '09115556677',
    items: [
      { productId: 4, name: 'Styro Sheet 1 inch', price: 180, quantity: 3 }
    ],
    total: 540,
    status: 'Processing',
    createdAt: '2024-04-15T10:20:00Z'
  }
];

export const initialDeliveries = [
  {
    id: 1,
    orderId: 1,
    customerName: 'Maria Santos',
    customerContact: '09123456789',
    items: [
      { product: 'Styro Ball 2 inch', quantity: 10, price: 15 },
      { product: 'Styro Ball 4 inch', quantity: 5, price: 30 }
    ],
    total: 300,
    location: 'Davao City',
    status: 'Arrived',
    createdAt: '2024-04-12T10:00:00Z',
    orderCreatedAt: '2024-04-12T09:00:00Z'
  },
  {
    id: 2,
    orderId: 4,
    customerName: 'Pedro Garcia',
    customerContact: '09988776655',
    items: [
      { product: 'Styro Ball 4 inch', quantity: 8, price: 30 },
      { product: 'Styro Sheet 1/2 inch', quantity: 1, price: 100 }
    ],
    total: 340,
    location: 'Tagum City',
    status: 'On the way',
    createdAt: '2024-04-11T17:00:00Z',
    orderCreatedAt: '2024-04-11T16:45:00Z'
  },
  {
    id: 3,
    orderId: 5,
    customerName: 'Rosa Mendoza',
    customerContact: '09115556677',
    items: [
      { product: 'Styro Sheet 1 inch', quantity: 3, price: 180 }
    ],
    total: 540,
    location: 'Panabo City',
    status: 'Ready to deliver',
    createdAt: '2024-04-15T11:00:00Z',
    orderCreatedAt: '2024-04-15T10:20:00Z'
  }
];

export const stockHistory = [80, 95, 72, 110, 88, 120, 108, 130, 115, 140];
export const volHistory = [280, 310, 295, 340, 360, 375, 358, 390, 370, 410];