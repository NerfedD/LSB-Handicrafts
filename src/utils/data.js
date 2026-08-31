/**
 * Fallback data, used when Supabase returns an empty table (see
 * AdminDashboard's load effect). These objects flow straight into
 * storageManager's inventoryToRow, so they must carry the FULL camelCase key
 * set — a missing key here is silently written to the database as that
 * column's default the first time anything syncs.
 *
 * SKUs follow a scheme so they stay sortable and guessable:
 *   balls   SB-{diameter x 10}          SB-040 = 4"
 *   sheets  SS-{thickness x 100}-{L}X{W}  SS-100-2X4 = 1" thick, 2ft x 4ft
 *
 * `stock` counts selling units. A row with unit 'pack' and packSize 25 storing
 * stock: 8 means eight packs, i.e. 200 balls.
 */

export const initialInventory = [
  // --- Styro balls. Small sizes move by the pack, large ones by the piece. ---
  {
    id: 1, sku: 'SB-010', name: 'Styro Ball 1"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 1, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'pack', packSize: 25, isCuttable: false,
    price: 60.00, stock: 40, maxStock: 120, lowStockThreshold: 15, reserved: 0, status: 'In Stock',
  },
  {
    id: 2, sku: 'SB-015', name: 'Styro Ball 1-1/2"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 1.5, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'pack', packSize: 25, isCuttable: false,
    price: 90.00, stock: 32, maxStock: 100, lowStockThreshold: 12, reserved: 0, status: 'In Stock',
  },
  {
    id: 3, sku: 'SB-020', name: 'Styro Ball 2"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 2, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'pack', packSize: 12, isCuttable: false,
    price: 85.00, stock: 48, maxStock: 150, lowStockThreshold: 20, reserved: 0, status: 'In Stock',
  },
  {
    id: 4, sku: 'SB-030', name: 'Styro Ball 3"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 3, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'piece', packSize: 1, isCuttable: false,
    price: 25.00, stock: 220, maxStock: 500, lowStockThreshold: 60, reserved: 0, status: 'In Stock',
  },
  {
    id: 5, sku: 'SB-040', name: 'Styro Ball 4"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 4, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'piece', packSize: 1, isCuttable: false,
    price: 45.00, stock: 45, maxStock: 300, lowStockThreshold: 50, reserved: 0, status: 'Low Stock',
  },
  {
    id: 6, sku: 'SB-050', name: 'Styro Ball 5"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 5, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'piece', packSize: 1, isCuttable: false,
    price: 70.00, stock: 90, maxStock: 200, lowStockThreshold: 30, reserved: 0, status: 'In Stock',
  },
  {
    id: 7, sku: 'SB-060', name: 'Styro Ball 6"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 6, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'piece', packSize: 1, isCuttable: false,
    price: 95.00, stock: 60, maxStock: 150, lowStockThreshold: 25, reserved: 0, status: 'In Stock',
  },
  {
    id: 8, sku: 'SB-080', name: 'Styro Ball 8"', category: 'Styro Balls',
    productType: 'ball', diameterIn: 8, thicknessIn: null, lengthFt: null, widthFt: null,
    unit: 'piece', packSize: 1, isCuttable: false,
    price: 160.00, stock: 18, maxStock: 80, lowStockThreshold: 20, reserved: 0, status: 'Low Stock',
  },

  // --- Styro sheets. All cuttable, so they can back a cut-to-size order. ---
  {
    id: 9, sku: 'SS-050-2X4', name: 'Styro Sheet 1/2" × 2ft × 4ft', category: 'Styro Sheets',
    productType: 'sheet', diameterIn: null, thicknessIn: 0.5, lengthFt: 4, widthFt: 2,
    unit: 'sheet', packSize: 1, isCuttable: true,
    price: 125.00, stock: 200, maxStock: 400, lowStockThreshold: 50, reserved: 0, status: 'In Stock',
  },
  {
    id: 10, sku: 'SS-100-2X4', name: 'Styro Sheet 1" × 2ft × 4ft', category: 'Styro Sheets',
    productType: 'sheet', diameterIn: null, thicknessIn: 1, lengthFt: 4, widthFt: 2,
    unit: 'sheet', packSize: 1, isCuttable: true,
    price: 180.00, stock: 10, maxStock: 300, lowStockThreshold: 40, reserved: 0, status: 'Low Stock',
  },
  {
    id: 11, sku: 'SS-200-2X4', name: 'Styro Sheet 2" × 2ft × 4ft', category: 'Styro Sheets',
    productType: 'sheet', diameterIn: null, thicknessIn: 2, lengthFt: 4, widthFt: 2,
    unit: 'sheet', packSize: 1, isCuttable: true,
    price: 320.00, stock: 75, maxStock: 200, lowStockThreshold: 25, reserved: 0, status: 'In Stock',
  },
  {
    id: 12, sku: 'SS-100-4X8', name: 'Styro Sheet 1" × 4ft × 8ft', category: 'Styro Sheets',
    productType: 'sheet', diameterIn: null, thicknessIn: 1, lengthFt: 8, widthFt: 4,
    unit: 'sheet', packSize: 1, isCuttable: true,
    price: 620.00, stock: 55, maxStock: 150, lowStockThreshold: 20, reserved: 0, status: 'In Stock',
  },
  {
    id: 13, sku: 'SS-200-4X8', name: 'Styro Sheet 2" × 4ft × 8ft', category: 'Styro Sheets',
    productType: 'sheet', diameterIn: null, thicknessIn: 2, lengthFt: 8, widthFt: 4,
    unit: 'sheet', packSize: 1, isCuttable: true,
    price: 1150.00, stock: 34, maxStock: 120, lowStockThreshold: 15, reserved: 0, status: 'In Stock',
  },
  {
    id: 14, sku: 'SS-300-4X8', name: 'Styro Sheet 3" × 4ft × 8ft', category: 'Styro Sheets',
    productType: 'sheet', diameterIn: null, thicknessIn: 3, lengthFt: 8, widthFt: 4,
    unit: 'sheet', packSize: 1, isCuttable: true,
    price: 1680.00, stock: 12, maxStock: 80, lowStockThreshold: 10, reserved: 0, status: 'In Stock',
  },
  {
    id: 15, sku: 'SS-400-4X8', name: 'Styro Sheet 4" × 4ft × 8ft', category: 'Styro Sheets',
    productType: 'sheet', diameterIn: null, thicknessIn: 4, lengthFt: 8, widthFt: 4,
    unit: 'sheet', packSize: 1, isCuttable: true,
    price: 2200.00, stock: 6, maxStock: 60, lowStockThreshold: 8, reserved: 0, status: 'Low Stock',
  },
];

export const initialDeliveries = [
  { id: 1, product: 'Styro Ball 4"', size: '4"', location: 'Digos City', amount: 50, status: 'Not Yet Delivered', createdAt: 'Apr 10, 2026' },
  { id: 2, product: 'Styro Sheet 1/2" × 2ft × 4ft', size: '1/2" × 2ft × 4ft', location: 'General Santos', amount: 100, status: 'On The Way', createdAt: 'Apr 10, 2026' },
  { id: 3, product: 'Order #123456 - Walk-in Customer', size: 'Order Package', location: 'Davao City', amount: 15, status: 'Delivered', createdAt: 'Apr 16, 2026' },
  { id: 4, product: 'Order #654321 - Maria Clara', size: 'Order Package', location: 'Panabo City', amount: 34, status: 'On The Way', createdAt: 'Apr 17, 2026' },
];

/**
 * One order per line kind, so every branch of the order UI has something to
 * render on a fresh install.
 *
 * Ids 123456 and 654321 are load-bearing: initialDeliveries above references
 * them by the "Order #{id}" string that links a delivery back to its order.
 */
export const initialOrders = [
  {
    id: 1,
    customerName: 'Juan Dela Cruz',
    items: [
      { kind: 'catalog', productId: 4, sku: 'SB-030', name: 'Styro Ball 3"', unit: 'piece', packSize: 1, unitPrice: 25.00, price: 25.00, quantity: 40, lineTotal: 1000.00, stockUnits: 40 },
      { kind: 'catalog', productId: 5, sku: 'SB-040', name: 'Styro Ball 4"', unit: 'piece', packSize: 1, unitPrice: 45.00, price: 45.00, quantity: 20, lineTotal: 900.00, stockUnits: 20 },
    ],
    totalAmount: 1900.00,
    status: 'Pending',
    createdAt: 'Apr 12, 2026',
    stockCommittedAt: null,
  },
  {
    id: 123456,
    customerName: 'Walk-in Customer',
    items: [
      {
        kind: 'cut', productId: 10, sku: 'SS-100-2X4',
        name: 'Cut Styro Sheet 1" — 1ft × 2ft',
        cut: { thicknessIn: 1, lengthFt: 1, widthFt: 2 },
        unitPrice: 60.00, price: 60.00, quantity: 15, lineTotal: 900.00,
        yieldPerSheet: 4, stockUnits: 4,
        notes: 'Cut for signage backing. Customer collecting offcuts.',
      },
    ],
    totalAmount: 900.00,
    status: 'Completed',
    createdAt: 'Apr 16, 2026',
    stockCommittedAt: 'Apr 16, 2026',
  },
  {
    id: 654321,
    customerName: 'Maria Clara',
    items: [
      {
        kind: 'custom', productId: null,
        name: 'Foam letters "HAPPY BIRTHDAY" — 12in, 2in thick',
        description: 'Hand-carved block letters, 13 characters, painted white.',
        unitPrice: 350.00, price: 350.00, quantity: 13, lineTotal: 4550.00,
        stockUnits: 0,
      },
      {
        kind: 'negotiated', productId: 13, sku: 'SS-200-4X8',
        name: 'Styro Sheet 2" × 4ft × 8ft',
        listPrice: 1150.00, unitPrice: 980.00, price: 980.00,
        quantity: 20, lineTotal: 19600.00, stockUnits: 20,
        reason: 'Bulk order — 20 sheets, regular account.',
      },
    ],
    totalAmount: 24150.00,
    status: 'Pending',
    createdAt: 'Apr 17, 2026',
    stockCommittedAt: null,
  },
];
