import { SIGNED_IN_EMAIL, TABLES } from "./fixtures.js";

/**
 * A stand-in for Supabase, installed as a Playwright network route.
 *
 * WHY STUB RATHER THAN POINT AT THE REAL PROJECT. Three reasons, in order of
 * how much they matter:
 *
 *   1. A test that writes to the real database is a test nobody dares run
 *      twice. These screens delete staff accounts and deduct stock.
 *   2. Screenshots have to be stable. Against live data the products list looks
 *      different every week and nobody can tell a regression from a sale.
 *   3. The interesting states — stock run out, a late delivery, a blocked
 *      account — have to be PRESENT. A healthy production database exercises
 *      almost none of the design.
 *
 * WHAT IT IS NOT. It does not implement PostgREST. It answers the shapes this
 * app sends: selects with the filters in FILTERS below, `or=(...)`, `order`
 * and `limit`; single-row insert/update/delete with `?id=eq.N`; and the
 * command RPCs. Anything else falls through to a 501 and the test fails loudly
 * rather than quietly returning nothing.
 */

const same = (a, b) => (a !== null && b !== '' && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b)) ? Number(a) === Number(b) : String(a) === String(b));
const compare = (a, b) => (!Number.isNaN(Number(a)) && !Number.isNaN(Number(b)) ? Number(a) - Number(b) : String(a).localeCompare(String(b)));
/** An ilike pattern as a regex: % and * match anything, _ one character, \x is a literal x. */
function likeRegex(pattern) {
  const literal = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, (m) => `\\${m}`);
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) source += literal(pattern[++i]);
    else if (c === '%' || c === '*') source += '.*';
    else if (c === '_') source += '.';
    else source += literal(c);
  }
  return new RegExp(`^${source}$`, 'i');
}

/** PostgREST operators, as the app uses them. */
const FILTERS = {
  eq: (value, arg) => value !== null && value !== undefined && same(value, arg),
  neq: (value, arg) => !same(value, arg),
  gt: (value, arg) => value !== null && value !== undefined && compare(value, arg) > 0,
  gte: (value, arg) => value !== null && value !== undefined && compare(value, arg) >= 0,
  lt: (value, arg) => value !== null && value !== undefined && compare(value, arg) < 0,
  lte: (value, arg) => value !== null && value !== undefined && compare(value, arg) <= 0,
  in: (value, arg) => arg.replace(/^\(|\)$/g, '').split(',').some((one) => same(value, one)),
  is: (value, arg) => (arg === 'null' ? value === null || value === undefined : String(value) === arg),
  ilike: (value, arg) => likeRegex(arg).test(String(value ?? '')),
};

/** "col.op.value" -> predicate on a row. */
function condition(text) {
  const [column, op, ...rest] = text.split('.');
  const test = FILTERS[op];
  if (!test) throw new Error(`stub: unsupported filter ${text}`);
  const arg = rest.join('.');
  return (row) => test(row[column], arg);
}

/** Splits "a.eq.1,b.in.(1,2)" on top-level commas. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const c of text) {
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === ',' && depth === 0) { parts.push(current); current = ''; } else current += c;
  }
  if (current) parts.push(current);
  return parts;
}

/** Applies a GET's filters, ordering and limit to a table's rows. */
function select(rows, params) {
  let result = [...rows];
  for (const [key, value] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    if (key === 'or') {
      const tests = splitTopLevel(value.replace(/^\(|\)$/g, '')).map(condition);
      result = result.filter((row) => tests.some((test) => test(row)));
    } else {
      const test = condition(`${key}.${value}`);
      result = result.filter(test);
    }
  }
  const order = (params.get('order') ?? 'id.asc').split(',').map((part) => part.split('.'));
  result.sort((a, b) => {
    for (const [column, direction = 'asc'] of order) {
      const x = a[column] ?? null;
      const y = b[column] ?? null;
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const diff = compare(x, y);
      if (diff) return direction === 'desc' ? -diff : diff;
    }
    return 0;
  });
  const offset = Number(params.get('offset') ?? 0);
  const limit = Number(params.get('limit') ?? 1000);
  return result.slice(offset, offset + limit);
}

/** Stands in for the customer_order_stats view: whole-history sums per customer. */
function customerStats(orders) {
  const byKey = new Map();
  for (const order of orders) {
    const key = order.customer_id != null ? `id:${order.customer_id}` : `name:${String(order.customer_name || '').trim().toLowerCase()}`;
    const row = byKey.get(key) ?? { customer_key: key, order_count: 0, completed_count: 0, open_count: 0, spent: 0, last_order_at: null };
    if (order.status !== 'Cancelled') {
      row.order_count += 1;
      row.spent += Number(order.total_amount || 0) - Number(order.refunded_amount || 0);
      if (!row.last_order_at || order.created_at > row.last_order_at) row.last_order_at = order.created_at;
    }
    if (order.status === 'Completed') row.completed_count += 1;
    if (order.status === 'Pending') row.open_count += 1;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

/** Records a stock change the way the database trigger does. */
function recordMovement(tables, row, change, kind, extra = {}) {
  if (!change) return;
  tables.stock_movements.push({
    id: nextRecordId(), inventory_id: row.id, raw_material_id: null, item_code: row.sku, item_name: row.name,
    quantity_change: change, balance_after: row.stock, kind, reason: null, note: null, order_id: null,
    supplier_order_id: null, batch_id: null, actor_staff_id: 1, actor_name: 'Maria Santos',
    created_at: new Date().toISOString(), ...extra,
  });
}

/**
 * Stands in for private.record_id_seq.
 *
 * Starts where the real sequence does, so an id minted here is the same shape
 * as one from the database and cannot be mistaken for a fixture's.
 */
let recordId = 2_000_000_000_000;
const nextRecordId = () => (recordId += 1);


/**
 * Stands in for public.order_command.
 *
 * WHY THE STUB HAS TO KNOW ABOUT THIS ONE. Every other RPC answers null here,
 * which is harmless because nothing reads the result. This one IS the write
 * path for marking an order done, calling it off, reopening it, refunding it
 * and dispatching it -- the browser sends stock DELTAS plus the order patch and
 * the whole thing lands in one transaction. Answering null would fail every one
 * of those with "No saved record was returned".
 *
 * It applies the same rules the SQL does, in the same order, because a stub
 * that accepts what the database would refuse is a stub that makes the tests
 * lie: the status checks, the delta applied relative to the row that is there
 * now, and the refusal when a delta names a row the shelf list does not have.
 */
function runOrderCommand(tables, body, onWrite) {
  const { p_action: action, p_data: data } = body;
  const orders = tables.orders ?? [];
  const deliveries = tables.deliveries ?? [];
  const inventory = tables.inventory ?? [];

  const storedOrder = orders.find((row) => Number(row.id) === Number(data.orderId));
  const order = storedOrder ? structuredClone(storedOrder) : null;
  if (!order) throw new Error("stub: order_command got an order id it does not have");

  const storedDelivery =
    data.deliveryId == null
      ? null
      : deliveries.find((row) => Number(row.id) === Number(data.deliveryId)) ?? null;
  const delivery = storedDelivery ? structuredClone(storedDelivery) : null;
  if (data.expectedRevision !== (order.revision ?? 0)) {
    return { error: 'This order changed. Refresh it before trying again.', code: '40001' };
  }
  if (delivery && data.expectedDeliveryRevision !== (delivery.revision ?? 0)) {
    return { error: 'This delivery changed. Refresh it before trying again.', code: '40001' };
  }

  if (action === "replace") {
    if (order.status === "Cancelled") return { error: "This order was called off, so nothing on it can be replaced." };
    const line = order.items[data.lineIndex];
    const held = Number(line?.committedUnits ?? (order.stock_committed_at ? line?.stockUnits ?? line?.quantity : 0)) || 0;
    if (!line || data.quantity < 1 || data.quantity > held) {
      return { error: `Only goods the customer received can be replaced: up to ${held} on this line.` };
    }
    const moved = [];
    if (data.disposition === "restock" && line.productId != null) {
      const back = inventory.find((item) => Number(item.id) === Number(line.productId));
      back.stock += data.quantity;
      recordMovement(tables, back, data.quantity, "return", { order_id: order.id, reason: data.reason });
      moved.push(back);
    }
    const out = inventory.find((item) => Number(item.id) === Number(data.replacementProductId ?? line.productId));
    if (!out || out.stock < data.replacementQuantity) return { error: "The replacement is not on the shelf." };
    out.stock -= data.replacementQuantity;
    recordMovement(tables, out, -data.replacementQuantity, "replacement", { order_id: order.id, reason: data.reason });
    if (!moved.includes(out)) moved.push(out);
    order.replacement_history = [...(order.replacement_history ?? []), {
      id: crypto.randomUUID(), lineIndex: data.lineIndex, productId: line.productId, name: line.name,
      quantity: data.quantity, disposition: data.disposition, reason: data.reason, note: data.note ?? null,
      replacementProductId: out.id, replacementName: out.name, replacementQuantity: data.replacementQuantity,
      handledBy: "Maria Santos", handledByStaffId: 1, replacedAt: new Date().toISOString(),
    }];
    order.revision = (order.revision ?? 0) + 1;
    Object.assign(storedOrder, order);
    onWrite?.({ table: "orders", method: "RPC", row: order });
    return { order, delivery: null, inventory: moved, removedDeliveries: [] };
  }

  if (action === "complete" && order.status !== "Pending") {
    return { error: "Only an order that is still waiting can be marked done." };
  }
  if (action === "dispatch" && order.status === "Cancelled") {
    return { error: "This order has been called off, so nothing can go out on it." };
  }

  const touched = [];
  for (const { productId, delta } of data.deltas ?? []) {
    if (!delta) continue;
    const row = touched.find((item) => Number(item.id) === Number(productId))
      ?? structuredClone(inventory.find((item) => Number(item.id) === Number(productId)));
    // The real function aborts the whole transaction here, which is what stops
    // an unloaded shelf list from silently "succeeding".
    if (!row) return { error: 'One of the products on this order is not on the shelf list.' };
    row.stock = Number(row.stock) + Number(delta);
    if (row.stock < 0) return { error: 'There is not enough of one of these products left to do that.' };
    if (!touched.includes(row)) touched.push(row);
    row.lastDelta = (row.lastDelta ?? 0) + Number(delta);
  }

  const COLUMN = {
    items: "items",
    status: "status",
    stockCommittedAt: "stock_committed_at",
    backorderStatus: "backorder_status",
    refundedAmount: "refunded_amount",
    refundHistory: "refund_history",
    totalAmount: "total_amount",
  };
  for (const [key, value] of Object.entries(data.order ?? {})) {
    if (COLUMN[key]) order[COLUMN[key]] = value;
  }
  order.revision = (order.revision ?? 0) + 1;

  if (delivery && data.delivery) {
    const DCOLUMN = { status: "status", itemsManifest: "items_manifest", driver: "driver" };
    for (const [key, value] of Object.entries(data.delivery)) {
      if (DCOLUMN[key]) delivery[DCOLUMN[key]] = value;
    }
    delivery.revision = (delivery.revision ?? 0) + 1;
  }

  const kind = { complete: 'sale', dispatch: 'dispatch', refund: 'return' }[action] ?? 'cancellation';
  for (const row of touched) {
    const change = row.lastDelta;
    delete row.lastDelta;
    Object.assign(inventory.find((item) => item.id === row.id), row);
    recordMovement(tables, row, change, kind, { order_id: order.id });
  }
  // As order_command does: a delivery that never left goes with the cancelled order.
  const removedDeliveries = [];
  if (action === 'cancel') {
    for (const run of [...deliveries]) {
      const theirs = run.order_id != null ? Number(run.order_id) === Number(order.id) : String(run.product).startsWith(`Order #${order.id} - `);
      if (theirs && !['On The Way', 'Delivered'].includes(run.status) && !(run.items_manifest ?? []).length) {
        deliveries.splice(deliveries.indexOf(run), 1);
        removedDeliveries.push(run.id);
      }
    }
  }
  Object.assign(storedOrder, order);
  if (storedDelivery) Object.assign(storedDelivery, delivery);
  onWrite?.({ table: "orders", method: "RPC", row: order });
  if (delivery) onWrite?.({ table: "deliveries", method: "RPC", row: delivery });

  return { order, delivery, inventory: touched, removedDeliveries };
}

/** An unsigned JWT. Nothing client-side verifies it; supabase-js only decodes. */
function fakeJwt(payload) {
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.stub-signature`;
}

/**
 * `as` is the email the stub signs in as. It defaults to the administrator,
 * which is what nearly every case wants; pass another staff member's address
 * to exercise a screen as a role that sees less of it.
 */
export async function stubSupabase(page, { onWrite, as = SIGNED_IN_EMAIL, dropOrderResponseOnce = false } = {}) {
  // A per-run copy, so a test that blocks an account does not leak that state
  // into the next test in the file.
  const tables = Object.fromEntries(
    Object.entries(TABLES).map(([name, rows]) => [name, structuredClone(rows)])
  );
  for (const name of ['raw_materials', 'raw_material_orders', 'production_batches', 'production_recipes', 'production_defect_logs', 'raw_material_lots', 'production_material_usage']) tables[name] ??= [];
  tables.stock_movements ??= [];
  tables.loyalty_rules ??= [{ id: 1, enabled: false, regular_after_orders: 3, reward_after_orders: 5, reward_percent: 5, revision: 0, updated_at: null, updated_by: null }];
  const stockRequests = new Map();
  const orderRequests = new Map();

  const json = (route, body, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });

  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith("/token")) {
      const now = Math.floor(Date.now() / 1000);
      const user = { id: "stub-user", email: as, aud: "authenticated" };
      return json(route, {
        // NO staff_* claims: that is the default install, where the access-token
        // hook has not been enabled — so the app takes its read-then-route path
        // and the test exercises resolveStaff() rather than skipping past it.
        access_token: fakeJwt({ sub: "stub-user", email: as, exp: now + 3600 }),
        refresh_token: "stub-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        user,
      });
    }

    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, body: "" });
    if (url.pathname.endsWith("/user")) {
      return json(route, { id: "stub-user", email: as });
    }
    if (url.pathname.endsWith("/recover")) return json(route, {});
    return json(route, {});
  });

  // Edge Functions. The staff-delete and create-account flows ask
  // `delete-staff-auth-user` to clear the Supabase Auth user behind a staff
  // row — a real network call that would otherwise escape this stub, fail, and
  // land in the console check as an error the app did not actually make.
  //
  // It answers the shape the function answers, not a bare 200: the client
  // reads `deleted` to tell "there was nothing to remove" from "it was
  // removed", and a test that asserted on the wrong one would pass for the
  // wrong reason.
  await page.route("**/functions/v1/**", async (route) => {
    onWrite?.({ table: "functions", method: route.request().method(), row: null });
    return json(route, { ok: true, deleted: true });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/rpc/order_command")) {
      const body = request.postDataJSON();
      const previous = orderRequests.get(body.p_request_id);
      if (previous) {
        if (previous.payload !== JSON.stringify(body)) return json(route, { code: 'P0001', message: 'This request has changed.' }, 400);
        return json(route, previous.result);
      }
      const result = runOrderCommand(tables, body, onWrite);
      if (result.error) return json(route, { code: result.code ?? 'P0001', message: result.error }, 400);
      orderRequests.set(body.p_request_id, { payload: JSON.stringify(body), result: structuredClone(result) });
      if (dropOrderResponseOnce) {
        dropOrderResponseOnce = false;
        return route.abort('connectionreset');
      }
      return json(route, result);
    }
    if (url.pathname.endsWith("/rpc/stock_command")) {
      const { p_action: action, p_data: data, p_request_id: key } = request.postDataJSON();
      if (stockRequests.has(key)) return json(route, stockRequests.get(key));
      const row = tables.inventory.find((item) => Number(item.id) === Number(data.id));
      if (data.target !== 'product' || !row) return json(route, { code: 'P0001', message: 'stub: product stock only' }, 400);
      const amount = Number(data.quantity);
      const change = action === 'record_damage' ? -amount : amount - row.stock;
      if (action === 'record_damage' && amount > row.stock) {
        return json(route, { code: 'P0001', message: `Only ${row.stock} on the shelf, so ${amount} cannot be written off.` }, 400);
      }
      if (action === 'correct_count' && Number(data.expectedStock) !== row.stock) {
        return json(route, { code: '40001', message: 'The shelf count changed since you opened this. Close it and look again.' }, 400);
      }
      row.stock += change;
      row.revision = (row.revision ?? 0) + 1;
      recordMovement(tables, row, change, action === 'record_damage' ? 'damage' : 'adjustment', { reason: data.reason, note: data.note || null });
      const result = { target: 'product', inventory: structuredClone(row) };
      stockRequests.set(key, result);
      onWrite?.({ table: 'inventory', method: 'RPC', row, action });
      return json(route, result);
    }
    if (url.pathname.endsWith("/rpc/remove_product")) {
      const { p_product_id: id } = request.postDataJSON();
      const product = tables.products.find((row) => Number(row.id) === Number(id));
      const stock = tables.inventory.find((row) => String(row.sku).toLowerCase() === String(product?.item_code).toLowerCase());
      const referenced = stock && tables.orders.some((order) => (order.items ?? []).some((line) => Number(line.productId) === Number(stock.id)));
      if (referenced) {
        product.status = 'Archived';
        onWrite?.({ table: 'products', method: 'RPC', row: product });
        return json(route, { outcome: 'archived' });
      }
      tables.products.splice(tables.products.indexOf(product), 1);
      if (stock) tables.inventory.splice(tables.inventory.indexOf(stock), 1);
      onWrite?.({ table: 'products', method: 'RPC', row: product });
      return json(route, { outcome: 'deleted' });
    }
    if (url.pathname.includes("/rpc/")) return json(route, null);

    // /rest/v1/<table>  ->  ["", "rest", "v1", "<table>"]
    const key = url.pathname.split("/")[3];
    const rows = key === 'customer_order_stats' ? customerStats(tables.orders) : tables[key];
    if (!rows) {
      return json(route, { message: `stub has no table "${key}"` }, 501);
    }

    const method = request.method();

    if (method === "GET") {
      return json(route, select(rows, url.searchParams));
    }

    // `?id=eq.1041` is the only filter these screens send on a write.
    const idFilter = url.searchParams.get("id");
    const id = idFilter ? Number(idFilter.replace("eq.", "")) : null;
    const body = request.postData() ? JSON.parse(request.postData()) : null;

    if (method === "POST") {
      const sent = Array.isArray(body) ? body[0] : body;
      // The id is assigned HERE because the real database assigns it: every
      // table defaults `id` to private.record_id_seq and the app deliberately
      // omits the column (see storageManager.createRow). A stub that echoed the
      // posted body straight back would hand the app a row with no id, which is
      // the one shape PostgREST never returns -- and the screens would take
      // their "the row saved but its number did not come back" branch on every
      // single insert.
      const created = sent?.id === undefined || sent?.id === null
        ? { ...sent, id: nextRecordId() }
        : sent;
      rows.push(created);
      onWrite?.({ table: key, method, row: created });
      return json(route, [created], 201);
    }

    if (method === "PATCH") {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return json(route, [], 200);
      const expected = url.searchParams.get('revision');
      if (expected && Number(expected.replace('eq.', '')) !== (rows[index].revision ?? 0)) return json(route, [], 200);
      rows[index] = { ...rows[index], ...body };
      if (['orders', 'deliveries', 'customers', 'suppliers', 'products', 'inventory', 'staff', 'loyalty_rules'].includes(key)) rows[index].revision = (rows[index].revision ?? 0) + 1;
      onWrite?.({ table: key, method, row: rows[index] });
      return json(route, [rows[index]]);
    }

    if (method === "DELETE") {
      const index = rows.findIndex((r) => r.id === id);
      if (index !== -1) rows.splice(index, 1);
      onWrite?.({ table: key, method, id });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        // The delete path checks an exact count, so the stub has to send the
        // header PostgREST would — otherwise a successful delete reports as
        // "you do not have permission".
        //
        // AND IT HAS TO EXPOSE IT. content-range is not a CORS-safelisted
        // response header, so without access-control-expose-headers the
        // browser hands supabase-js a null count and the delete reports as a
        // permission failure anyway. Sending the header is not the same as the
        // page being allowed to read it, and only a test that clicks all the
        // way through a delete notices the difference.
        headers: {
          "content-range": index === -1 ? "*/0" : "*/1",
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range",
        },
        body: "[]",
      });
    }

    return json(route, {}, 501);
  });

  return tables;
}

/** Signs in through the real form, against the stub above. */
export async function signIn(page, baseURL, as = SIGNED_IN_EMAIL) {
  await page.goto(baseURL);
  await page.getByLabel("Username or email").fill(as);
  await page.getByLabel("Password", { exact: true }).fill("stub-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();
}
