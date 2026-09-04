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
 * WHAT IT IS NOT. It does not implement PostgREST. It answers the handful of
 * shapes this app actually sends: a whole-table select ordered by id, and
 * single-row insert/update/delete with `?id=eq.N`. If a screen starts issuing
 * something else, the request falls through to a 501 and the test fails loudly
 * rather than quietly returning nothing.
 */

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

export async function stubSupabase(page, { onWrite } = {}) {
  // A per-run copy, so a test that blocks an account does not leak that state
  // into the next test in the file.
  const tables = Object.fromEntries(
    Object.entries(TABLES).map(([name, rows]) => [name, rows.map((r) => ({ ...r }))])
  );

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
      const user = { id: "stub-user", email: SIGNED_IN_EMAIL, aud: "authenticated" };
      return json(route, {
        // NO staff_* claims: that is the default install, where the access-token
        // hook has not been enabled — so the app takes its read-then-route path
        // and the test exercises resolveStaff() rather than skipping past it.
        access_token: fakeJwt({ sub: "stub-user", email: SIGNED_IN_EMAIL, exp: now + 3600 }),
        refresh_token: "stub-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        user,
      });
    }

    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, body: "" });
    if (url.pathname.endsWith("/user")) {
      return json(route, { id: "stub-user", email: SIGNED_IN_EMAIL });
    }
    if (url.pathname.endsWith("/recover")) return json(route, {});
    return json(route, {});
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.includes("/rpc/")) return json(route, null);

    // /rest/v1/<table>  ->  ["", "rest", "v1", "<table>"]
    const key = url.pathname.split("/")[3];
    const rows = tables[key];
    if (!rows) {
      return json(route, { message: `stub has no table "${key}"` }, 501);
    }

    const method = request.method();

    if (method === "GET") return json(route, rows);

    // `?id=eq.1041` is the only filter these screens send on a write.
    const idFilter = url.searchParams.get("id");
    const id = idFilter ? Number(idFilter.replace("eq.", "")) : null;
    const body = request.postData() ? JSON.parse(request.postData()) : null;

    if (method === "POST") {
      const created = Array.isArray(body) ? body[0] : body;
      rows.push(created);
      onWrite?.({ table: key, method, row: created });
      return json(route, [created], 201);
    }

    if (method === "PATCH") {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return json(route, [], 200);
      rows[index] = { ...rows[index], ...body };
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
        headers: { "content-range": index === -1 ? "*/0" : "*/1", "access-control-allow-origin": "*" },
        body: "[]",
      });
    }

    return json(route, {}, 501);
  });

  return tables;
}

/** Signs in through the real form, against the stub above. */
export async function signIn(page, baseURL) {
  await page.goto(baseURL);
  await page.getByLabel("Username or email").fill(SIGNED_IN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill("stub-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();
}
