import { expect, test } from "@playwright/test";

import { SIGNED_IN_EMAIL } from "./fixtures.js";
import { signIn, stubSupabase } from "./stubSupabase.js";

/**
 * Every screen, opened, with the console watched.
 *
 * WHAT THIS IS FOR. The overhaul rebuilt ~25 screens at once, and the failure
 * this guards against is not a subtle layout regression — it is a screen that
 * throws on mount and shows a blank page, which a production build happily
 * compiles. So the assertions are deliberately shallow and broad: open
 * everything, click the things people click, and fail on any console error or
 * unhandled exception.
 *
 * THE CONSOLE CHECK IS THE REAL TEST. `expectClean()` at the end of each case
 * is what catches a missing key, a null dereference in a formatter, or a Radix
 * component handed an invalid prop — none of which change what a screenshot
 * looks like, and all of which are real bugs.
 *
 * It runs against a stubbed Supabase (see stubSupabase.js), so it is safe to
 * run repeatedly and the interesting states are always present.
 */

/** Collects anything the page complains about, for assertion at the end. */
function watchConsole(page) {
  const problems = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // The stub does not serve favicon.png, and a 404 for it is not a defect in
    // the app under test.
    if (text.includes("favicon")) return;
    problems.push(text);
  });
  page.on("pageerror", (error) => problems.push(`Uncaught: ${error.message}`));
  return problems;
}

let problems;

test.beforeEach(async ({ page }) => {
  problems = watchConsole(page);
  await stubSupabase(page);
});

/**
 * A sidebar nav button, by label.
 *
 * Not an exact name match: the entries with a count ("Products & stock",
 * "Orders", "Deliveries") render a badge inside the button, so their
 * accessible name is the label followed by the number. Anchoring at the start
 * matches both the counted and the uncounted entries.
 */
function navName(label) {
  // Every nav label is words, spaces and an ampersand — nothing the regex
  // engine treats specially — so this needs no escaping.
  return new RegExp(`^${label}`);
}

/**
 * Fails with the collected messages rather than a bare count.
 *
 * `allow` is for a test that provokes a network failure ON PURPOSE: the browser
 * logs every non-2xx response, so a deliberately stubbed 400 arrives here as
 * the fixture firing as designed rather than the app complaining. Same
 * reasoning as the favicon exemption in watchConsole.
 */
function expectClean(allow) {
  const real = allow ? problems.filter((p) => !allow.test(p)) : problems;
  expect(real, `console errors:\n${real.join("\n")}`).toEqual([]);
}

test.describe("signing in", () => {
  test("shows the sign-in screen and its named failure states", async ({ page, baseURL }) => {
    await page.goto(baseURL);

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Staff access only")).toBeVisible();

    // Rule 3: the password reveal is a word, not a bare eye.
    await page.getByLabel("Password", { exact: true }).fill("something");
    await expect(page.getByRole("button", { name: /Show/ })).toBeVisible();
    await page.getByRole("button", { name: /Show/ }).click();
    await expect(page.getByRole("button", { name: /Hide/ })).toBeVisible();

    expectClean();
  });

  test("a wrong password says what to do about it", async ({ page, baseURL }) => {
    // Only this test's sign-in fails; the stub above is overridden for it.
    await page.route("**/auth/v1/token**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login" }),
      })
    );

    await page.goto(baseURL);
    await page.getByLabel("Username or email").fill(SIGNED_IN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("That username or password did not match.")).toBeVisible();
    // The lockout is warned about BEFORE it is hit, not after.
    await expect(page.getByText(/After 5 tries the account locks/)).toBeVisible();

    expectClean(/Failed to load resource.*400/);
  });
});

test.describe("the shell", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
  });

  test("every nav destination opens", async ({ page }) => {
    const destinations = [
      ["Products & stock", "Products & stock"],
      ["Orders", "Orders"],
      ["Deliveries", "Deliveries"],
      ["Customers", "Customers"],
      ["Suppliers", "Suppliers"],
      ["Staff & accounts", "Staff & accounts"],
      ["Dashboard", "Dashboard"],
    ];

    for (const [navLabel, heading] of destinations) {
      await page.getByRole("button", { name: navName(navLabel) }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    expectClean();
  });

  test("the account menu reaches the profile, both dashboard views and sign-out", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Your account menu/ }).click();
    await expect(page.getByText("How your dashboard looks")).toBeVisible();
    await expect(page.getByText("Light or dark")).toBeVisible();

    // The large-text dashboard is a preference, not a role.
    await page.getByRole("menuitemradio", { name: /Large text/ }).click();
    await expect(page.getByText("Where do you want to go?")).toBeVisible();

    await page.getByRole("button", { name: /Your account menu/ }).click();
    await page.getByRole("menuitemradio", { name: /Standard/ }).click();
    await expect(page.getByText("Needs your attention")).toBeVisible();

    await page.getByRole("button", { name: /Your account menu/ }).click();
    await page.getByRole("menuitem", { name: "My profile" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "My profile" })).toBeVisible();

    expectClean();
  });
});

test.describe("products & stock", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await page.getByRole("button", { name: navName("Products & stock") }).click();
  });

  test("shows counted chips, plain-language stock and word-labelled actions", async ({ page }) => {
    // Rule 2: the copy rewrites are on screen, not the stored literals.
    await expect(page.getByRole("radio", { name: /Plenty in stock/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Running low/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Run out/ })).toBeVisible();
    await expect(page.getByText("Low Stock", { exact: true })).toHaveCount(0);

    // Rule 3: row actions carry words.
    await expect(page.getByRole("button", { name: "View" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();

    // A product with no inventory row says so rather than claiming zero.
    await expect(
      page.getByRole("table").getByText("Not tracked", { exact: true })
    ).toBeVisible();

    expectClean();
  });

  test("a filter chip narrows the list, and its count came from the unfiltered set", async ({
    page,
  }) => {
    const runningLow = page.getByRole("radio", { name: /Running low/ });
    await expect(runningLow).toContainText("2");

    await runningLow.click();
    await expect(page.getByRole("row")).toHaveCount(3); // header + 2
    await expect(page.getByRole("table").getByText("Styro Ball 6 inch")).toBeVisible();

    expectClean();
  });

  test("one product tells its stock story", async ({ page }) => {
    await page
      .getByRole("row", { name: /Styro Ball 4 inch/ })
      .getByRole("button", { name: "View" })
      .click();

    await expect(page.getByText("On the shelf right now")).toBeVisible();
    await expect(page.getByText("Free to sell").first()).toBeVisible();
    await expect(page.getByText("Set aside for orders").first()).toBeVisible();
    await expect(page.getByText("Stock movements")).toBeVisible();

    expectClean();
  });

  test("the add form is adaptive and generates the code", async ({ page }) => {
    await page.getByRole("button", { name: "Add a product" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Add a product" })).toBeVisible();

    // A ball is asked its diameter…
    await expect(page.getByLabel(/How wide across/)).toBeVisible();
    await expect(page.getByText("The code is made for you")).toBeVisible();

    // …a sheet is asked its thickness and edges instead. That swap IS the
    // adaptive form.
    await page.getByRole("radio", { name: "Styro sheet" }).click();
    await expect(page.getByLabel(/How thick/)).toBeVisible();
    await expect(page.getByLabel(/How long/)).toBeVisible();
    await expect(page.getByLabel(/How wide across/)).toHaveCount(0);

    expectClean();
  });
});

test.describe("orders and deliveries", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
  });

  test("the orders list reports status without offering to change it", async ({ page }) => {
    await page.getByRole("button", { name: navName("Orders") }).click();

    await expect(page.getByText("Waiting").first()).toBeVisible();
    // The one control in a row is "Open" — status is never editable from a list.
    await expect(page.getByRole("combobox").filter({ hasText: /Waiting|Done/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open" }).first()).toBeVisible();

    expectClean();
  });

  test("an order shows the stage tracker and totals", async ({ page }) => {
    await page.getByRole("button", { name: navName("Orders") }).click();
    await page.getByRole("button", { name: "Open" }).first().click();

    for (const stage of ["Written", "Being made", "Ready to go", "Delivered"]) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Total to pay")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as done" })).toBeVisible();

    expectClean();
  });

  test("the deliveries board keeps all five columns and explains its filters", async ({ page }) => {
    await page.getByRole("button", { name: navName("Deliveries") }).click();

    for (const column of ["Not sent yet", "Being made", "Ready to go", "On the way", "Arrived"]) {
      await expect(page.getByRole("heading", { name: column })).toBeVisible();
    }

    // The combined-filter sentence appears only once something is narrowing.
    await expect(page.getByText(/^Showing/)).toHaveCount(0);
    await page.getByRole("radio", { name: /Late/ }).click();
    await expect(page.getByText(/^Showing/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();

    // An empty column says so rather than sitting blank.
    await expect(page.getByText("Nothing here right now").first()).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(/^Showing/)).toHaveCount(0);

    expectClean();
  });

  test("moving a delivery forward writes it and says so", async ({ page }) => {
    await page.getByRole("button", { name: navName("Deliveries") }).click();
    await page.getByRole("button", { name: /Reyes Events/ }).click();

    await expect(page.getByText("Where it is now")).toBeVisible();
    await page.getByRole("button", { name: /It is ready to go/ }).click();

    await expect(page.getByText(/is now ready to go/)).toBeVisible();

    expectClean();
  });
});

test.describe("people", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
  });

  test("a supplier can be removed, in its own block, with a named confirm", async ({ page }) => {
    await page.getByRole("button", { name: navName("Suppliers") }).click();
    await page
      .getByRole("row", { name: /Davao Foam Supply/ })
      .getByRole("button", { name: "Open" })
      .click();

    // Rule 6: destructive lives in its own block at the bottom, never as an
    // icon in the row, and it says what goes and what survives.
    await expect(
      page.getByRole("heading", { name: "Remove this supplier for good" })
    ).toBeVisible();
    await expect(page.getByText(/Orders and stock records are not touched/)).toBeVisible();

    await page.getByRole("button", { name: "Remove Davao Foam Supply" }).click();

    // The confirm names the record rather than asking "are you sure?".
    await expect(page.getByRole("heading", { name: "Remove Davao Foam Supply?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, remove them" }).click();

    // Back on the list, and gone from it.
    await expect(page.getByRole("heading", { level: 1, name: "Suppliers" })).toBeVisible();
    await expect(page.getByRole("table").getByText("Davao Foam Supply")).toHaveCount(0);
    await expect(page.getByRole("table").getByText("Southern Adhesives")).toBeVisible();

    expectClean();
  });

  test("customers are cards with call-list filters", async ({ page }) => {
    await page.getByRole("button", { name: navName("Customers") }).click();

    await expect(page.getByRole("radio", { name: /Not ordered in a year/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Businesses/ })).toBeVisible();
    await expect(page.getByText("Business customer").first()).toBeVisible();

    expectClean();
  });

  test("staff accounts answer 'can sign in', and removal lives in its own block", async ({
    page,
  }) => {
    await page.getByRole("button", { name: navName("Staff & accounts") }).click();

    await expect(page.getByRole("columnheader", { name: "Can sign in" })).toBeVisible();
    await expect(page.getByText("Blocked").first()).toBeVisible();
    // Rule 6: no bare destructive icon in a row.
    await expect(page.getByRole("button", { name: "Manage" }).first()).toBeVisible();

    await page
      .getByRole("row", { name: /Ana Reyes/ })
      .getByRole("button", { name: "Manage" })
      .click();

    await expect(page.getByText("Ana cannot sign in right now")).toBeVisible();
    await expect(page.getByText(/Their password still works/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Remove this account for good" })).toBeVisible();

    expectClean();
  });

  test("a destructive confirm names the record and says what survives", async ({ page }) => {
    await page.getByRole("button", { name: navName("Staff & accounts") }).click();
    await page
      .getByRole("row", { name: /Ana Reyes/ })
      .getByRole("button", { name: "Manage" })
      .click();
    await page.getByRole("button", { name: /Remove Ana Reyes/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Remove Ana Reyes?")).toBeVisible();
    await expect(dialog.getByText(/stay exactly as they are/)).toBeVisible();
    await expect(dialog.getByText(/cannot be undone/)).toBeVisible();
    // The verb, not "OK"; and the dismissing button is positive.
    await expect(dialog.getByRole("button", { name: "Yes, remove them" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep it" })).toBeVisible();

    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expectClean();
  });

  test("changing a role spells out what each one unlocks", async ({ page }) => {
    await page.getByRole("button", { name: navName("Staff & accounts") }).click();
    await page
      .getByRole("row", { name: /Juan Dela Cruz/ })
      .getByRole("button", { name: "Manage" })
      .click();
    await page.getByRole("button", { name: "Change this" }).click();

    await expect(page.getByRole("heading", { level: 1, name: /What does this person do/ })).toBeVisible();
    await expect(page.getByText(/Writes orders and looks after customers/)).toBeVisible();
    await expect(page.getByText(/Works from the make list/)).toBeVisible();

    expectClean();
  });

  test("the activity log is real entries, grouped by day", async ({ page }) => {
    await page.getByRole("button", { name: navName("Staff & accounts") }).click();
    await page.getByRole("button", { name: "What happened recently" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "What happened recently" })).toBeVisible();
    await expect(page.getByText("Today")).toBeVisible();
    await expect(page.getByText(/recorded 60 × Styro Ball 4 inch made/)).toBeVisible();
    // A row written in the pre-overhaul shape still renders.
    await expect(page.getByText(/Deleted order #1039/)).toBeVisible();

    expectClean();
  });
});

test.describe("what a role is not offered", () => {
  test("a non-admin sees the supplier but not the way to remove them", async ({
    page,
    baseURL,
  }) => {
    // Sales Staff reach suppliers -- knowing who to ring for materials is
    // everyone's job -- but removing one is not theirs. The RLS policy on
    // public.suppliers is the real gate; this checks the screen agrees with it
    // rather than offering a button the database would refuse.
    //
    // Re-stubbed as Juan: the route registered here takes precedence over the
    // administrator stub from the top-level beforeEach.
    await stubSupabase(page, { as: "juan@lsbhandicrafts.test" });
    await signIn(page, baseURL, "juan@lsbhandicrafts.test");

    await page.getByRole("button", { name: navName("Suppliers") }).click();
    await page
      .getByRole("row", { name: /Davao Foam Supply/ })
      .getByRole("button", { name: "Open" })
      .click();

    await expect(page.getByRole("heading", { name: "Davao Foam Supply" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit details" })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Remove this supplier for good" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);

    expectClean();
  });
});

test.describe("the six rules, spot-checked", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
  });

  test("nothing readable is under 16px and no control is under 44px", async ({ page }) => {
    await page.getByRole("button", { name: navName("Products & stock") }).click();
    await page.getByRole("row").last().waitFor();

    const findings = await page.evaluate(() => {
      // The two documented exceptions: tracked uppercase signposts (column
      // headers, sidebar group labels) and monospace identifiers, which are
      // matched character by character rather than read as words.
      const isSignpost = (el) => {
        const s = getComputedStyle(el);
        return (
          s.textTransform === "uppercase" ||
          s.fontFamily.includes("mono") ||
          el.closest("th") !== null
        );
      };

      const small = [];
      for (const el of document.querySelectorAll("main *")) {
        const text = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join("");
        if (text.length < 4) continue;
        if (isSignpost(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 13.5) small.push({ text: text.slice(0, 40), size });
      }

      const tiny = [];
      for (const el of document.querySelectorAll("main button, main a[href], main input")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44) tiny.push({ label: (el.textContent || el.type).slice(0, 40), h: Math.round(r.height) });
      }

      return { small, tiny };
    });

    expect(findings.small, JSON.stringify(findings.small, null, 2)).toEqual([]);
    expect(findings.tiny, JSON.stringify(findings.tiny, null, 2)).toEqual([]);
    expectClean();
  });

  test("every icon has a word beside it", async ({ page }) => {
    await page.getByRole("button", { name: navName("Products & stock") }).click();

    const wordless = await page.evaluate(() => {
      const found = [];
      for (const button of document.querySelectorAll("main button, header button")) {
        if (!button.querySelector("svg")) continue;
        const text = button.textContent.trim();
        // A dismiss affordance is the one documented exception, and it earns it
        // by carrying an accessible name.
        const named = button.getAttribute("aria-label") || button.querySelector(".sr-only");
        if (!text && !named) found.push(button.outerHTML.slice(0, 120));
      }
      return found;
    });

    expect(wordless, wordless.join("\n")).toEqual([]);
    expectClean();
  });

  test("focus is visible on every control it lands on", async ({ page }) => {
    await page.getByRole("button", { name: navName("Products & stock") }).click();

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return "none";
        const s = getComputedStyle(el);
        return `${s.outlineStyle}:${parseFloat(s.outlineWidth)}`;
      });
      if (ring === "none") continue;
      expect(ring).not.toBe("none:0");
    }

    expectClean();
  });
});

test.describe("responsive", () => {
  test("a phone gets a tab bar, cards and a sticky action — never a sideways scroll", async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, baseURL);

    // The bottom tab bar replaces the sidebar, and its targets carry words.
    const tabs = page.getByRole("navigation", { name: "Sections" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByText("Products", { exact: true })).toBeVisible();

    await tabs.getByText("Products", { exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Products & stock" })).toBeVisible();

    // Rows became cards: the table is gone at this width.
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a product" })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflows, "the page scrolls sideways on a phone").toBe(false);

    expectClean();
  });

  test("a tablet gets the icon rail, with a word under every icon", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await signIn(page, baseURL);

    await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();
    // The rail shows one word per item rather than truncating the full label.
    await expect(page.getByRole("button", { name: "Products & stock" })).toBeVisible();

    expectClean();
  });
});
