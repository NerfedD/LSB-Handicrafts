# Testing

## Automated checks

```bash
npm run lint          # ESLint
npm test              # unit tests + database tests (Vitest)
npm run build         # production build
npx playwright test   # browser tests (installed Microsoft Edge)
```

| Suite | Where | What it proves | What it cannot |
| --- | --- | --- | --- |
| Unit | `src/utils/*.test.js` | Stock arithmetic (partial deliveries, returns, legacy orders), order totals, permissions table, customer totals and loyalty maths, what the reorder point puts on the make list, routing, phone rules, retry identity. | Anything a screen does. |
| Database | `src/utils/*Database.test.js`, `schemaInstall.test.js`, `qaAudit.test.js` | The **real** `supabase/schema.sql` running in PGlite (in-process Postgres) with Supabase's roles and JWT functions stubbed (`src/test/database.js`): fresh install and re-run, every migration mirrored, stock movements, damage and count corrections, undoing a damage record, supplier receipts, correcting and removing a raw material, replacements, refund validation, cancelling, archiving, role policies, loyalty validation, audit triggers, stale-save refusal. | Lock contention between separate connections (PGlite has one), hosted Auth, real network grants. |
| Browser | `tests/*.spec.js` | Every screen end to end against a stubbed Supabase (`tests/stubSupabase.js`, fixtures in `tests/fixtures.js`), including lost responses, retries, stale saves, roles, phone widths and print. | The real database: the stub applies the same rules in JavaScript. |

Browser tests start the dev server on port 5199 themselves and run one worker at a time: the stub and sign-in fixtures are not built to be shared between parallel workers. `npx playwright install` is not needed; the config drives the installed Edge (`channel: "msedge"`). Drop that line to use Playwright's own Chromium instead.

## Checks that need a real project

Run these on a staging project after applying a migration or deploying functions:

- `supabase/verify_production.sql` in the SQL editor: purchasing, receiving and production with role boundaries, inside a transaction that ends in `ROLLBACK`. (`npm test` also runs it against the schema in PGlite.)
- `supabase/integrity_check.sql`: the data report (read-only).
- Sign in as each demo role and check what each can see and do against the roles table in [workflows.md](workflows.md#roles).
- Create a staff account, sign in with it from another browser, block it, and confirm the other session loses access on its next refresh. Delete it and confirm the login is gone.
- Record damage on a product, correct a count, receive a supplier delivery, and replace goods on a delivered order; each appears in the stock history with your name.

## Testing with other people

Notes for putting the app in front of a group — classmates, shop staff, anyone who did not build it — with sign-ins that need no real email.

### The logins

Supabase Auth signs in with an email address, but nobody has to receive mail:

| Username | Role | Address behind it |
| --- | --- | --- |
| `admin` | Admin | `admin@email.com` |
| `manager` | Manager | `manager@email.com` |
| `sales` | Sales Staff | `sales@email.com` |
| `production` | Production Staff | `prod@email.com` |
| `delivery` | Delivery Staff | `delivery@email.com` |

- **Accounts are created already confirmed.** `admin-accounts` calls `auth.admin.createUser({ email_confirm: true })`. An account made by hand in the dashboard needs **Auto Confirm User** ticked, or it can never sign in.
- **People type a username.** The `sign-in` Edge Function resolves it server-side; the browser is never told the address.
- **Forgot password** is the one flow that sends mail. Reset a tester's password from the dashboard instead.

### Check the logins first

```bash
LSB_DEMO_PASSWORD='the-demo-password' node scripts/check-logins.mjs
```

One `PASS`/`FAIL` line per account, through the same Edge Function the browser uses. The password comes from the environment and must not be committed.

### The sign-in rate limit

`/auth/v1/token` is limited per IP address (a bucket of 30, refilled at `rate_limit_token_refresh` per hour). Every **username** sign-in reaches it from the `sign-in` function, so a whole class shares one bucket; failed attempts spend from it too. Raise it before a group session (Authentication → Rate Limits, or the Management API) and put it back afterwards — it is the brute-force protection. `node scripts/check-logins.mjs --burst 30` measures the ceiling but spends 30 real attempts.

### Several people, several devices

- Each browser has its own session; signing out on one leaves the others alone.
- Changes made elsewhere appear within a minute on the screen you are on, or when you come back to the window if what it shows is older than 30 seconds. There is no live push.
- Two people changing the same record: the second save is refused with "this record changed", and the form keeps what they typed. Stock and money actions queue behind each other in the database instead.
- A new account can take up to 30 seconds to sign in (the `sign-in` function caches the roster). A changed role applies at once in the database; the screens catch up on the next refresh.
