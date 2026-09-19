/**
 * Checks that the demo logins actually work, against the REAL project.
 *
 * WHY THIS EXISTS ALONGSIDE THE OTHER TESTS. The Playwright specs run against a
 * stubbed Supabase, deliberately (see tests/stubSupabase.js) -- they prove the
 * screens behave, not that the project behind them is in a fit state. The two
 * failures that actually ruin a class session are invisible to them:
 *
 *   the account is not there    somebody cleared auth.users, or seeded the
 *                               staff rows without creating the sign-ins, and
 *                               the first person to try finds out in front of
 *                               everybody.
 *   the sign-in path is down    the `sign-in` Edge Function is not deployed, or
 *                               was deployed with verify_jwt on, and every
 *                               username sign-in fails while email ones work.
 *
 * Run it before handing the site to anyone:
 *
 *   LSB_DEMO_PASSWORD='the-demo-password' node scripts/check-logins.mjs
 *
 * THE PASSWORD IS NOT IN THIS FILE and must not be put here. It comes from the
 * environment, so the repository never carries a working credential.
 *
 * --burst N additionally fires N sign-ins at once, which is the only honest way
 * to see the rate-limit ceiling described in docs/TESTING.md. It uses real
 * attempts against the shared per-IP bucket, so do it once, well before a
 * session, not five minutes into one.
 */
import { readFileSync } from "node:fs";

const ACCOUNTS = [
  { username: "admin", role: "Admin" },
  { username: "manager", role: "Manager" },
  { username: "sales", role: "Sales Staff" },
  { username: "production", role: "Production Staff" },
  { username: "delivery", role: "Delivery Staff" },
];

function env() {
  // Read .env directly rather than depending on the app's Vite pipeline: this
  // script is run by hand, from a terminal, by somebody checking a deployment.
  const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const read = (key) =>
    text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1).trim().replace(/^"|"$/g, "");
  const url = read("VITE_SUPABASE_URL");
  const anonKey = read("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env");
    process.exit(2);
  }
  return { url, anonKey };
}

const { url, anonKey } = env();
const password = process.env.LSB_DEMO_PASSWORD;
if (!password) {
  console.error("Set LSB_DEMO_PASSWORD to the demo account password, e.g.\n" +
    "  LSB_DEMO_PASSWORD='...' node scripts/check-logins.mjs");
  process.exit(2);
}

/** One sign-in through the same door the browser uses. */
async function signIn(username) {
  const started = Date.now();
  const response = await fetch(`${url}/functions/v1/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ identifier: username, password }),
  });
  const ms = Date.now() - started;
  // The function answers 200 even for a refused sign-in and puts the verdict in
  // the body; a non-200 here means the transport or the function itself failed.
  let body = null;
  try {
    body = await response.json();
  } catch {
    return { ok: false, ms, why: `HTTP ${response.status}, and the body was not JSON. Is the function deployed?` };
  }
  if (body?.session?.access_token) return { ok: true, ms, email: body.user?.email };
  if (body?.error?.status === 429) return { ok: false, ms, why: "rate limited (429)", rateLimited: true };
  return { ok: false, ms, why: body?.error?.message ?? `HTTP ${response.status}` };
}

const burstArg = process.argv.indexOf("--burst");
const burst = burstArg === -1 ? 0 : Number(process.argv[burstArg + 1] ?? 0);

console.log(`Checking ${ACCOUNTS.length} demo logins against ${url}\n`);

let failed = 0;
for (const account of ACCOUNTS) {
  const result = await signIn(account.username);
  if (result.ok) {
    console.log(`  PASS  ${account.username.padEnd(11)} ${String(result.ms).padStart(5)}ms  ${account.role} -> ${result.email}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${account.username.padEnd(11)} ${String(result.ms).padStart(5)}ms  ${result.why}`);
  }
}

if (burst > 0) {
  console.log(`\nFiring ${burst} sign-ins at once, as "admin", to find the ceiling:`);
  const results = await Promise.all(Array.from({ length: burst }, () => signIn("admin")));
  const ok = results.filter((r) => r.ok).length;
  const limited = results.filter((r) => r.rateLimited).length;
  const slowest = Math.max(...results.map((r) => r.ms));
  console.log(`  ${ok}/${burst} signed in, ${limited} rate limited, slowest ${slowest}ms`);
  if (limited > 0) {
    console.log("\n  Raise rate_limit_token_refresh before the session -- see docs/TESTING.md.");
  }
}

if (failed > 0) {
  console.log(`\n${failed} of ${ACCOUNTS.length} demo logins are not usable. See docs/TESTING.md.`);
  process.exit(1);
}
console.log("\nAll demo logins work.");
