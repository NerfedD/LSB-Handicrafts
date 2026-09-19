# Testing with other people

Notes for putting this in front of a group — classmates, the shop staff, anyone
who is not the person who built it. Written for the state the project is in:
**not production**, deliberately, with sign-ins that do not involve real email.

---

## 1. The logins, and why no real email is needed

Supabase Auth authenticates on an email address, so every account has one. None
of them has to *receive* anything:

| Username     | Role             | Address behind it     |
| ------------ | ---------------- | --------------------- |
| `admin`      | Admin            | `admin@email.com`     |
| `manager`    | Manager          | `manager@email.com`   |
| `sales`      | Sales Staff      | `sales@email.com`     |
| `production` | Production Staff | `prod@email.com`      |
| `delivery`   | Delivery Staff   | `delivery@email.com`  |

`@email.com` is not a mailbox anybody owns, and nothing is ever sent to it. Two
things make that work:

- **Accounts are created already confirmed.** `supabase/functions/admin-accounts`
  calls `auth.admin.createUser({ email_confirm: true })`, so the password an
  administrator types works immediately with no confirmation link. Creating a
  user by hand in the dashboard does the same thing if **Auto Confirm User** is
  ticked — if it is not, that account can never sign in.
- **People type a username, not the address.** `LoginPage` sends the username to
  the `sign-in` Edge Function, which resolves it server-side. The browser is
  never told the address. Note `production` signs in against `prod@email.com`:
  the two do not have to match.

The one thing that genuinely needs real email is **Forgot password**, which
sends a link. Reset a tester's password from the dashboard instead
(Authentication → Users → ⋯ → Reset password), or have an admin recreate the
account.

## 2. Check the logins before the session, not during it

```bash
LSB_DEMO_PASSWORD='the-demo-password' node scripts/check-logins.mjs
```

Five lines, one per account, `PASS` or `FAIL`. It signs in through the same
Edge Function the browser uses, so it catches the two failures that the
Playwright specs cannot — a missing `auth.users` row, and a `sign-in` function
that is not deployed. It exits non-zero if anything is unusable.

The password is read from the environment and is deliberately **not** in the
repository. Do not add it.

## 3. The ceiling on simultaneous sign-ins

`/auth/v1/token` is rate limited **by IP address**: a bucket holding 30
requests, refilled at `rate_limit_token_refresh` per hour.

Every **username** sign-in reaches GoTrue from the `sign-in` Edge Function, so
all of them share **one** bucket no matter how many people or devices are
involved. Thirty classmates signing in over a few minutes sit right on the
limit; add a few mistyped passwords and the rest see *"Too many sign-in
attempts."* (Each failed attempt spends from the bucket too.)

Email sign-ins go straight from the person's own browser and keep their own
per-IP budget, which is why that path was deliberately left alone.

**Raise the limit before a group session.** Get a token from
<https://supabase.com/dashboard/account/tokens>, then:

```bash
export SUPABASE_ACCESS_TOKEN="your-access-token"
export PROJECT_REF="tvdtzsputfnapswpurlr"

# See where it is now
curl -s -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  | jq 'to_entries | map(select(.key | startswith("rate_limit_"))) | from_entries'

# Raise it
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "rate_limit_token_refresh": 1800 }'
```

Or **Authentication → Rate Limits** in the dashboard. Put it back down before
this is ever treated as production: the limit is brute-force protection, and on
a shared bucket it is the only thing standing between a guessed password and an
unlimited number of attempts.

To see the real ceiling for yourself:

```bash
LSB_DEMO_PASSWORD='...' node scripts/check-logins.mjs --burst 30
```

That spends 30 real attempts from the shared bucket, so run it well before a
session rather than during one.

## 4. Several people on the same account at once

Supported, and normal for a demo: each browser gets its own session with its own
refresh token, and signing in on one machine does not sign anyone out of
another.

What used to break was not the login but **saving**. Every record took its
primary key from `Date.now()` in the browser, which is only unique while one
person uses the system at a time. Two people saving an order in the same
millisecond produced the same key, and the loser was told their correctly filled
form was a duplicate. The eight core tables now default their `id` to
`private.record_id_seq` and the browser no longer sends one, so the database
hands out keys and no two callers can receive the same one.

### What is still worth knowing

- **Two people editing the same record still overwrite each other.** Saving
  writes the whole row, so the last save wins and the earlier one vanishes
  without warning. Refunds are the sharpest case: `refundHistory` is a JSON
  array rewritten in full, so two refunds recorded on one order at the same
  moment will keep only one. Have testers work on different orders.
- **A new account cannot sign in for up to 30 seconds.** The `sign-in` function
  caches the username roster for that long so a burst of sign-ins costs one
  database read instead of thirty. Wait half a minute after creating an account.
- **A changed role may not take effect until the person signs in again.** If
  the Customize Access Token hook is switched on (Authentication → Hooks →
  `public.custom_access_token_hook`), the role is stamped on the token and only
  changes when that refreshes, about an hour. Have them sign out and back in.
  Access itself is *not* stale either way — it is re-checked in the database on
  every statement, so blocking somebody takes effect immediately.
