# Admin remediation — findings and verification

Baseline: commit `86ee778`. Line numbers in the diagnostic table below refer to that unchanged baseline, so they remain useful when reviewing the patch. The application is `src/App.jsx`; this checkout has no `LSBAdminSystem.jsx` and no React Router dependency.

## 1. Diagnostic findings

| Scenario | Exact source and cause | Remediation |
| --- | --- | --- |
| Refresh loses the current page | `src/App.jsx:142` initializes an in-memory view. Session restoration at lines 330, 350 and 354 always selects `dashboard`. Navigation never writes record IDs or view state into the address bar. | URL-backed navigation with nested record routes, History back/forward handling, and separate restoration versus clean-login landing. Detail and edit pages wait for their collection before seeding inputs. |
| Active filters disappear | `src/components/orders/OrderListPage.jsx:86` and `:87` keep tab and sort exclusively in component state. The other list screens use the same pattern. | List tabs, searches, sort and other filters use `useUrlState`; unknown query parameters survive reloads. Query state is scoped to its own screen. |
| Blocked login becomes “wrong password” or “not set up” | `src/components/LoginPage.jsx:79` maps every Auth error to `wrong`. `supabase/schema.sql:589` permits staff reads only for active staff, hiding a blocked caller's own row. `src/App.jsx:429` also grants a claim-based head start before checking the current database row. | Dedicated Auth `user_banned` handling and a live error banner. The migration permits reading one's own staff status. Authentication waits for a fresh staff row; obsolete email-allowlist elevation is removed from the app. Network failures and rate limiting have separate messages. |
| Failed product add leaves the form | `src/App.jsx:821` detects partial inventory failure, then `:825` navigates to product detail. `src/components/products/ProductFormPage.jsx:163` does not await the save result. | Keep the form mounted, retain its values and product identity, render/focus the error boundary and retry the saved catalogue row without inserting another product. The generated item code remains stable during retries. |
| Other form failures lack focus/recovery | `src/components/customers/CustomerFormDialog.jsx:99` sets errors without focus; `:103` awaits a callback without catch/finally. Supplier and inventory dialogs have the same failure-handling gap. | Shared focus/scroll and toast reporting, field-level browser constraints, inline accessible error boundaries, try/finally, and success-only dismissal. Order/delivery partial creation also retains its form and retry identity. |
| Staff creation produces incomplete accounts | `src/components/staff/CreateAccountDialog.jsx:98` calls public `signUp`; `:108` separately creates staff through `src/App.jsx:516`. The password already exists in this dialog, but it goes only to the first call. Auth creation can succeed while staff creation fails, and email confirmation can prevent immediate login. | A server-only Auth Admin API handler validates and submits the password, confirms the email, and creates staff through an Auth insert trigger in the same database transaction. The browser never receives a service key or writes passwords into staff records. |
| Users or other new records disappear | `src/App.jsx:279` can start overlapping forced staff reads; `:296` applies their snapshots without freshness checks. `src/hooks/useSupabaseCollection.js:62` likewise replaces rows even if a create/update/delete completed after the read started. | Request generations, mutation revisions, session scoping and deduplicated local inserts prevent an old read from undoing a save. Focus refresh and a 30-second background refresh reconcile remote changes. Sign-out clears private row state and open dialogs. |
| Deletion does not remove credentials | `src/App.jsx:559` deletes only `public.staff`. The existing exact-count delete check correctly detects denied deletes, but nothing in the baseline deletes the matching Auth user. | An AFTER DELETE trigger removes the matching Auth identity in the same transaction. Existing self/owner protections still authorize the staff deletion first; live RLS checks deny a deleted user's already-issued token. |
| Orders have no drag workflow | `src/components/orders/OrderListPage.jsx:70` implements a read-only status list with no drag handlers or persisted ordering attribute. | “Arrange priority” provides draggable rows, equivalent Move up/down controls, immediate optimistic ordering and rollback. One RPC persists only priority positions, without rewriting status, stock or money fields. |
| Shell disappears on permission errors | `src/App.jsx:1851` returns a standalone denied screen outside the shared shell. Normal pages already use one persistent shell. | Denied views now render inside that shell. Existing desktop/sidebar, tablet rail and phone navigation remain intact. |
| Phone and numeric guards are incomplete | `src/components/ui/input.jsx` forwards unrestricted tel values; form callers use `noValidate` and often test only presence. `src/components/products/ProductFormPage.jsx:87` checks only a subset of numeric fields. | Shared inputs reject non-digit phone edits and enforce 7–15 digits. Pre-flight guards check native constraints before dispatch, with inline error text and focused invalid controls. Password, email, role and username provisioning constraints are also checked on the server. |

The old localStorage whole-table reconciliation is already absent at the baseline. No current entity-loading path reads localStorage, and no new entity cache was introduced. The remaining browser storage is for Auth and display preferences. The audit did not reproduce a user/item column-mapping mismatch: existing snake_case/camelCase mapping remains in use, and the added priority attribute has an explicit mapper. The existing Sonner layer was reused rather than replaced.

## 2. File modifications

The working tree contains the implementation. `admin-remediation.patch` is the complete unified code diff against the baseline, including new files; it is for review or applying to a clean checkout, not reapplying over this already-modified workspace.

- Routing/authentication and shell: `src/App.jsx`, `src/utils/routes.js`, `src/hooks/useUrlState.js`, `src/components/LoginPage.jsx`, and the list screens. The email-allowlist module `src/utils/adminAccess.js` had no remaining callers once authentication moved to the live staff row, so it and the `VITE_ADMIN_EMAILS` entry in `.env.example` are deleted; remove that variable from any local `.env` and from the deployment environment.
- Database state: `src/hooks/useSupabaseCollection.js`, `src/utils/storageManager.js`, `src/lib/supabaseClient.js`.
- Form guards and feedback: `src/utils/formErrors.js`, `src/components/shared/FormError.jsx`, shared Field/Input primitives, customer/supplier/product/order/inventory/staff forms, and profile editing screens.
- Order interaction: `src/components/orders/OrderPriorityBoard.jsx`, the order list, priority mapping and database RPC.
- Account provisioning: `src/utils/accounts.js`, `supabase/functions/admin-accounts/index.ts`, and `supabase/migrations/202609140001_admin_remediation.sql`.
- Regression coverage: `src/utils/routes.test.js`, `tests/remediation.spec.js`, and the corrected unsupported lockout assertion in `tests/smoke.spec.js`.

### Database and function installation

These backend changes are delivered as source. They have not been applied to a hosted Supabase project from this workspace.

1. Apply the existing `supabase/schema.sql` on a fresh database, then apply `supabase/migrations/202609140001_admin_remediation.sql`. On an existing installation, apply only the new migration after reviewing it. If the base schema is rerun later, rerun the migration afterward because the base schema replaces the staff read policy.
2. Deploy `supabase/functions/admin-accounts/index.ts` as the `admin-accounts` Edge Function. It uses Supabase's server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; neither is added to the browser environment. For a linked CLI project, use `supabase functions deploy admin-accounts`.
3. Deploy the frontend after both backend changes. Keep function JWT verification enabled. The handler independently verifies the token and reads the caller's current active Admin role before provisioning.
4. Validate the real Auth/database scenarios below in a staging project before rollout. Browser tests deliberately stub Supabase and cannot prove hosted triggers, privileges or project configuration.

The Auth insert trigger reads only `raw_app_meta_data`, which public sign-up cannot set. A staff constraint failure therefore rolls back Auth creation. The function additionally fails closed if the trigger is missing. Staff deletion removes the Auth identity transactionally; existing signed access tokens may remain cryptographically valid until expiry, but the application and RLS require a live active staff row.

API references: [Auth createUser and email confirmation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), and [Edge Function authentication](https://supabase.com/docs/guides/functions/auth).

## 3. Verification guide

Run the automated checks:

```powershell
npm run lint
npm test
npm run build
npx playwright test
npx --yes deno check --node-modules-dir=none --no-lock supabase/functions/admin-accounts/index.ts
```

The frontend is JavaScript and has no configured TypeScript type-check command. Vite compiles the JSX, ESLint checks source/hooks, and Playwright drives the actual React application. Deno checks the new server function separately.

Recorded results: ESLint passes with no warnings; 51 unit tests pass; all 45 browser scenarios pass (44 in the full final-source run, followed by the dashboard-alert test after correcting its locator from button to radio); the production build passes; Deno type-checks the Edge Function successfully. Vite reports a 607.52 kB main chunk, above its 500 kB advisory threshold. The complete diff also passes `git apply --reverse --check` against this workspace. Hosted SQL execution and real Supabase Auth behavior are not covered by the network-stubbed browser suite.

| Manual scenario | Expected result |
| --- | --- |
| Sign in, open `/products/1/edit?source=review` for an existing product and refresh | The exact path/query remains, the correct record populates after loading, and the sidebar stays anchored. Repeat for orders, customers, suppliers, deliveries and `/staff/ID/role`. |
| Change a list tab, search and sort, then refresh and use browser back/forward | The controls and result set agree with the URL. Unrelated query parameters are retained. |
| Sign out; directly visit `/products/new`; sign in | The clean login opens `/dashboard`, without the previous nested form or filters. |
| Authenticate a staff row with `Blocked` status, with and without the custom token hook enabled | The dedicated suspended/blocked message appears. A banned Auth user returning `user_banned` gets the same message. Wrong credentials and network failures remain distinct. |
| Block or delete a user while their other browser session is open | On focus or the next background refresh, application access ends. Database RLS denies subsequent requests immediately based on the missing/inactive staff row. |
| Submit an invalid product name, negative price, fractional stock count or zero dimension | No write dispatches. The invalid field is visible/focused with an error; valid quarter-inch dimensions remain accepted. |
| Reject a product insert or its inventory insert | The form and all inputs remain. The failure boundary receives focus and a toast explains the rejection. Retry a partial inventory failure: only one catalogue product and one inventory row should exist. |
| Reject customer/supplier creation, staff provisioning, or recording made stock | The dialog stays open, inputs remain, error text is visible/focused, and the submit control becomes usable again. Retry successfully and confirm immediate table/count changes. |
| Reject delivery creation while saving a new order | The order form remains populated and reports the partial save. Retry without creating a second order. |
| Type or paste phone letters, symbols, spaces, fewer than 7 digits or more than 15 digits | Invalid characters never enter the controlled value, and invalid lengths cannot submit. Use country-code digits without a plus sign for international numbers. |
| Create a staff account with a password satisfying the three displayed requirements | The administrator remains signed in; the new row appears immediately. In another browser, the account signs in using that exact password without email confirmation. Verify duplicate email/username failure creates no orphan Auth identity. |
| Delay a staff/database read, then add/update/delete a row and allow the old read to finish | Fresh changes remain visible. Switching tabs and refreshing must not restore old rows or erase new ones. Stale localStorage entity arrays, if left from older versions, have no effect. |
| Delete a non-owner staff account | The row disappears from `public.staff` and its Auth identity is removed. Refresh keeps it absent; password login and refresh-token renewal fail. Orders/activity remain. Self and owner deletion remain blocked. |
| Orders → Arrange priority; drag one row onto another | Its position changes immediately, saves, and survives refresh. Reject the RPC: previous order returns and an error toast explains it. Repeat with Move up/down using keyboard and touch. Status, stock and totals remain unchanged. |
| Open administrative pages, a long form, a modal and a denied route at desktop/tablet/phone widths | Desktop sidebar and tablet rail remain at the side; the phone retains its intended bottom navigation. No page-level horizontal overflow. Toasts remain available above dialogs. |

Known scope boundaries: cross-table product/order writes use explicit partial-save recovery rather than a new transaction covering the whole inventory workflow. Lost network responses can leave an uncertain write outcome; errors therefore retain the form and ask for retry/verification rather than claiming nothing was created. Hosted database policies/triggers and Auth deletion need the staging checks above. Existing order-to-customer links still use customer names; changing that data model requires a separate migration.
