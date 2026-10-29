import { expect, test } from "@playwright/test";

import { SIGNED_IN_EMAIL } from "./fixtures.js";
import { openNav, signIn, stubSupabase } from "./stubSupabase.js";

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
 *
 * SCOPE ORDER ASSERTIONS TO `main`. OrderSlip renders the printable copy of an
 * order through a portal onto document.body -- outside #root, always mounted,
 * and display:none until a print (src/index.css). It is invisible, but it is
 * still in the DOM and still matches getByText, and toBeVisible() enforces
 * strict mode, so any text appearing on both the screen and the slip resolves
 * to two elements and throws. Wrapping the locator in getByRole("main") excludes
 * the portal exactly, which is what tests/slip.spec.js already does.
 */

/**
 * Collects anything the page complains about, for assertion at the end.
 *
 * WHAT IS DELIBERATELY NOT A PROBLEM. This watches for defects in the app --
 * a missing key, a null dereference in a formatter, a Radix component handed an
 * invalid prop. A request to somebody else's server that did not arrive is not
 * one of those, and counting it as one makes the whole suite a test of the
 * machine's internet connection: index.html pulls Manrope from Google Fonts, so
 * on a blocked or offline network EVERY case that signs in fails at its console
 * check while the screen it was actually checking is perfectly correct. The
 * font has a fallback in the stack and the app is fully usable without it.
 *
 * Only third-party hosts the app cannot control are exempt. Anything served by
 * the app itself, including a failed lazy chunk, still counts.
 */
const IGNORED_SOURCES = [
  // The stub does not serve favicon.png, and a 404 for it is not a defect in
  // the app under test.
  "favicon",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

function watchConsole(page) {
  const problems = [];
  // The console message for a failed subresource is just "Failed to load
  // resource: ..." with no URL in the text, so the URL has to come from the
  // request that failed. Recorded here and matched against the message below.
  const failedUrls = [];
  page.on("requestfailed", (request) => failedUrls.push(request.url()));

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED_SOURCES.some((source) => text.includes(source))) return;
    if (
      text.includes("Failed to load resource") &&
      failedUrls.some((url) => IGNORED_SOURCES.some((source) => url.includes(source)))
    ) {
      return;
    }
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
    // Said twice in the page -- the navy panel at desktop width, the compact
    // brand row on a phone -- and only one of them is shown at a time.
    await expect(page.getByText("Staff access only").filter({ visible: true })).toBeVisible();

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
    await expect(page.getByText(/Check for capital letters and extra spaces/)).toBeVisible();

    expectClean(/Failed to load resource.*400/);
  });
});

test.describe("the shell", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
  });

  test("every nav destination opens", async ({ page }) => {
    // The design's nav labels: "Inventory" and "User Management".
    const destinations = [
      ["Inventory", "Inventory"],
      ["Orders", "Orders"],
      ["Deliveries", "Deliveries"],
      ["Customers", "Customers"],
      ["Suppliers", "Suppliers"],
      ["User Management", "User Management"],
      ["Staff Directory", "Staff Directory"],
      ["Batches", "Batches"],
      ["Dashboard", "Dashboard"],
    ];

    for (const [navLabel, heading] of destinations) {
      await openNav(page, navLabel);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    expectClean();
  });

  // The design's account menu holds Profile and Log out; the theme and the
  // dashboard's text size are preferences on the profile screen.
  test("the account menu reaches the profile, both dashboard views and sign-out", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /^Account menu for/ }).click();
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Maria Santos" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();

    // The large-text dashboard is a preference, not a role.
    await page.getByRole("radio", { name: /^Large text/ }).click();
    await openNav(page, "Dashboard");
    await expect(page.getByText("Where do you want to go?")).toBeVisible();

    await page.getByRole("button", { name: /^Account menu for/ }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await page.getByRole("radio", { name: /^Standard/ }).click();
    await openNav(page, "Dashboard");
    await expect(page.getByText("Where do you want to go?")).toHaveCount(0);

    expectClean();
  });
});

test.describe("products & stock", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
    await openNav(page, "Inventory");
  });

  // The design's Inventory screen: stock-level chips are toggle buttons in a
  // "Stock level" group, a product's name opens it, and the row's words
  // ("View product", "Edit product") sit in its "Actions for …" menu.
  const levels = (page) => page.getByRole("group", { name: "Stock level" });
  const openProduct = (page, name) =>
    page.getByRole("table").getByRole("button", { name, exact: true }).click();

  test("shows counted chips, plain-language stock and word-labelled actions", async ({ page }) => {
    // Rule 2: the copy rewrites are on screen, not the stored literals.
    await expect(levels(page).getByRole("button", { name: /In stock/ })).toBeVisible();
    await expect(levels(page).getByRole("button", { name: /Running low/ })).toBeVisible();
    await expect(levels(page).getByRole("button", { name: /^Out/ })).toBeVisible();
    await expect(page.getByText("Low Stock", { exact: true })).toHaveCount(0);

    // Rule 3: row actions carry words.
    await page.getByRole("button", { name: "Actions for Styro Ball 4 inch" }).click();
    await expect(page.getByRole("menuitem", { name: "View product" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Edit product" })).toBeVisible();
    await page.keyboard.press("Escape");

    // A product with no inventory row says so rather than claiming zero.
    await expect(
      page.getByRole("row", { name: /Carved centrepiece base/ }).getByText("Not tracked", { exact: true }).first()
    ).toBeVisible();

    expectClean();
  });

  test("a filter chip narrows the list, and its count came from the unfiltered set", async ({
    page,
  }) => {
    const runningLow = levels(page).getByRole("button", { name: /Running low/ });
    await expect(runningLow).toContainText("2");

    await runningLow.click();
    await expect(page.getByRole("row")).toHaveCount(3); // header + 2
    await expect(page.getByRole("table").getByText("Styro Ball 6 inch")).toBeVisible();

    expectClean();
  });

  test("one product tells its stock story", async ({ page }) => {
    await openProduct(page, "Styro Ball 4 inch");

    await expect(page.getByText("On the shelf", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Free to sell").first()).toBeVisible();
    await expect(page.getByText("Set aside for orders").first()).toBeVisible();
    await expect(page.getByText("Stock history", { exact: true })).toBeVisible();

    expectClean();
  });

  test("a product promised to an open order cannot be removed, and is told why", async ({
    page,
  }) => {
    // Order #1041 is still Waiting on 40 of these, so the block explains the
    // refusal rather than disappearing -- the same treatment as a customer with
    // an order open. "Why can't I delete this" deserves an answer on screen.
    await openProduct(page, "Styro Ball 4 inch");

    await expect(page.getByRole("heading", { name: "Remove this product" })).toBeVisible();
    await expect(page.getByText(/promised to an order that has not gone out/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Remove Styro Ball 4 inch/ })).toHaveCount(0);

    expectClean();
  });

  test("removing a product that has been sold keeps it, as no longer sold", async ({ page }) => {
    // Nothing is waiting on the 6 inch ball, but order #1043 sold 25 of them, so
    // the database archives it rather than deleting history. Nothing is deleted
    // from either table; the decision is one call to remove_product.
    const deleted = [];
    page.on("request", (request) => {
      if (request.method() === "DELETE") deleted.push(new URL(request.url()).pathname);
    });

    await openProduct(page, "Styro Ball 6 inch");

    await expect(page.getByText(/it is kept as .no longer sold. with its history/)).toBeVisible();
    await page.getByRole("button", { name: "Remove Styro Ball 6 inch" }).click();

    // The confirm names the record and says what survives.
    await expect(page.getByRole("heading", { name: "Remove Styro Ball 6 inch?" })).toBeVisible();
    await expect(page.getByText(/Past orders keep their lines/)).toBeVisible();
    await page.getByRole("button", { name: "Yes, remove it" }).click();

    await expect(page.getByText("Styro Ball 6 inch is no longer sold.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("table").getByText("Styro Ball 6 inch")).toHaveCount(0);
    await expect(page.getByRole("table").getByText("Styro Ball 4 inch")).toBeVisible();
    expect(deleted).toEqual([]);

    // Still there, under its own chip, and it can be put back on sale.
    await levels(page).getByRole("button", { name: /No longer sold/ }).click();
    await openProduct(page, "Styro Ball 6 inch");
    await page.getByRole("button", { name: "Put it back on sale" }).click();
    await expect(page.getByText("Styro Ball 6 inch is on sale again.")).toBeVisible();

    expectClean();
  });

  test("removing a product nothing refers to deletes both halves together", async ({ page }) => {
    await openProduct(page, "Styro Sheet 1 inch");
    await page.getByRole("button", { name: "Remove Styro Sheet 1 inch" }).click();
    await page.getByRole("button", { name: "Yes, remove it" }).click();

    await expect(page.getByText("Styro Sheet 1 inch was removed.")).toBeVisible();
    await expect(page.getByRole("table").getByText("Styro Sheet 1 inch", { exact: true })).toHaveCount(0);
    await expect(levels(page).getByRole("button", { name: /No longer sold/ })).toHaveCount(0);

    expectClean();
  });

  test("the add form is adaptive and generates the code", async ({ page }) => {
    await page.getByRole("button", { name: "Add product" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Add product" })).toBeVisible();

    // A ball is asked its diameter…
    await expect(page.getByLabel(/How wide across/)).toBeVisible();
    await expect(page.getByText("Made for you from the kind and the size.")).toBeVisible();

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

  // The design's Orders screen: status chips are toggle buttons in a "Show"
  // group, and each row's one control is "Open order <number>".
  const show = (page) => page.getByRole("group", { name: "Show" });
  const openFirstOrder = (page) => page.getByRole("button", { name: /^Open order \d+/ }).first().click();

  test("the orders list reports status without offering to change it", async ({ page }) => {
    await openNav(page, "Orders");

    await expect(page.getByRole("table").getByText("Waiting").first()).toBeVisible();
    // The one control in a row is "Open" — status is never editable from a list.
    await expect(page.getByRole("combobox").filter({ hasText: /Waiting|Done/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Open order \d+/ }).first()).toBeVisible();

    expectClean();
  });

  test("an order shows the stage tracker and totals", async ({ page }) => {
    await openNav(page, "Orders");
    await openFirstOrder(page);

    const stages = page.getByRole("list", { name: "Delivery stage" });
    for (const stage of ["Not yet sent", "Being made", "Ready to go", "On the way", "Delivered"]) {
      await expect(stages.getByText(stage, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("main").getByText("Order total")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as done" })).toBeVisible();

    expectClean();
  });

  test("a written order carries the id the stock maths reads", async ({ page }) => {
    // THE ONE ASSERTION THAT MATTERS IS ON THE SAVED ROW, not on the screen.
    //
    // `products` and `inventory` are separate tables joined on code, with
    // separate primary keys. Every stock function keys on the INVENTORY id, and
    // this form picks from the CATALOGUE — so a line saved with the id it has
    // in hand reserves nothing and deducts nothing, silently, while the order
    // looks perfectly normal in every screen. That is precisely what happened
    // to the first real order written here, and nothing caught it: the seed
    // data and these fixtures both already store inventory ids, so every other
    // test agreed with itself.
    //
    // Styro Ball 4 inch is products id 1 and inventory id 101. Storing 1 is the
    // bug; storing 101 is the fix, and only reading the request body can tell
    // them apart.
    const saved = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/rest/v1/orders")) {
        saved.push(JSON.parse(request.postData()));
      }
    });

    await openNav(page, "Orders");
    await page.getByRole("button", { name: "New order" }).click();

    // Scoped to <main>: the sidebar's "Customers" nav button carries that as
    // its aria-label, and an unscoped getByLabel finds it first.
    const form = page.getByRole("main");
    await form.getByLabel(/^Customer/).fill("Luis Benito");
    await form.getByLabel("Item").click();
    await page.getByRole("option", { name: /Styro Ball 4 inch/ }).click();
    await form.getByLabel("How many").fill("5");

    // No address, so the form asks once whether this is a shop collection
    // before it writes an order with no delivery behind it. It asks, it does
    // not refuse — the second press goes through.
    await page.getByRole("button", { name: "Create order", exact: true }).click();
    await expect(page.getByText(/no delivery is raised for this order/)).toBeVisible();
    expect(saved).toHaveLength(0);

    await page.getByRole("button", { name: "Create it anyway" }).click();
    // A written order opens on its own screen, not back on the list.
    await expect(page.getByRole("heading", { level: 1, name: /^Order #\d+/ })).toBeVisible();

    expect(saved).toHaveLength(1);
    const line = saved[0].items[0];
    expect(line.name).toBe("Styro Ball 4 inch");
    expect(line.productId).toBe(101); // the inventory row, not products id 1

    expectClean();
  });

  test("the deliveries board keeps all five columns and explains its filters", async ({ page }) => {
    await openNav(page, "Deliveries");
    await page.getByRole("group", { name: "View", exact: true }).getByRole("button", { name: "Board", exact: true }).click();

    for (const column of ["Not yet sent", "Being made", "Ready to go", "On the way", "Delivered"]) {
      await expect(page.getByRole("heading", { name: column, exact: true })).toBeVisible();
    }

    // The count beside the filters says how much of the list is showing.
    await expect(page.getByText("7 of 7 deliveries")).toBeVisible();
    await page.getByRole("button", { name: /^Late/ }).click();
    await expect(page.getByText("1 of 7 deliveries")).toBeVisible();

    // An empty column says so rather than sitting blank.
    await expect(page.getByText("Nothing here right now").first()).toBeVisible();

    await page.getByRole("combobox", { name: "Due" }).click();
    await page.getByRole("option", { name: "Any day" }).click();
    await expect(page.getByText("7 of 7 deliveries")).toBeVisible();

    expectClean();
  });

  test("moving a delivery forward writes it and says so", async ({ page }) => {
    await openNav(page, "Deliveries");
    // #2041 is Reyes Events' delivery, still being made.
    await page.getByRole("button", { name: "#2041", exact: true }).click();

    await expect(page.getByRole("region", { name: "Delivery progress" })).toBeVisible();
    await page.getByRole("button", { name: "Mark ready" }).click();

    await expect(page.getByText(/is now ready to go/)).toBeVisible();

    expectClean();
  });

  test("sending a delivery out asks what actually went on the van", async ({ page }) => {
    await openNav(page, "Deliveries");
    // Ready to go -> On the way is the moment stock physically leaves, and the
    // only advance that asks. #2042 is Liza Villanueva's.
    await page.getByRole("button", { name: "#2042", exact: true }).click();
    await page.getByRole("button", { name: "Send out" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Delivery #2042 is on the way" })).toBeVisible();

    // "All of it" is chosen, because all of it is what usually happens; the
    // counts appear, pre-filled with all of it, once somebody says otherwise.
    await expect(dialog.getByRole("radio", { name: /Yes, all 4 items/ })).toBeChecked();
    await dialog.getByRole("radio", { name: "Some were left behind" }).click();
    const count = dialog.getByRole("spinbutton").first();
    await expect(count).toHaveValue("4");

    // Drop it, and the consequence is stated before anything is pressed.
    await count.fill("1");
    await expect(dialog.getByText("Some of this is being left behind")).toBeVisible();
    await expect(dialog.getByText(/A second delivery is raised/)).toBeVisible();

    await dialog.getByRole("button", { name: /Record what went, and raise the rest/ }).click();
    await expect(page.getByText(/went out short/)).toBeVisible();

    expectClean();
  });

  test("an order that went out short says so, and the tracker agrees", async ({ page }) => {
    await openNav(page, "Orders");

    // The chip counts from the unfiltered set, so it is readable before it is
    // clicked — and clicking it narrows the list to exactly that order.
    const chip = show(page).getByRole("button", { name: /Some left behind/ });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.getByRole("row").filter({ hasText: "Santos Catering" })).toHaveCount(1);

    await openFirstOrder(page);

    // The order is standing part-delivered, not finished.
    await expect(page.getByText("Goods still owed").first()).toBeVisible();
    await expect(
      page.getByText("Some of this order has not gone out yet")
    ).toBeVisible();
    await expect(page.getByText(/still set aside for Santos Catering/)).toBeVisible();

    // And the price correction on the same order names the day, the person and
    // the reason rather than silently showing a different total.
    await expect(page.getByText(/Price changed on .* by Maria Santos/).first()).toBeVisible();
    await expect(page.getByRole("main").getByText(/a cut was measured wrong/)).toBeVisible();

    expectClean();
  });

  test("the second run is linked to the one it follows", async ({ page }) => {
    await openNav(page, "Deliveries");

    // The marker suffix is not shown as part of anybody's name.
    const row = page.getByRole("row", { name: /Rest of an order/ });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Santos Catering");
    await expect(page.getByText("(backorder)")).toHaveCount(0);

    await row.getByRole("button", { name: "#2047", exact: true }).click();
    await expect(page.getByText("This is the rest of an earlier delivery")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open the first run" })).toBeVisible();

    expectClean();
  });
});

test.describe("money going back, and prices put right", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
  });

  const openShortOrder = async (page) => {
    await openNav(page, "Orders");
    await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /Some left behind/ }).click();
    await page.getByRole("button", { name: /^Open order \d+/ }).first().click();
  };

  test("a refund is listed with what happened to the goods", async ({ page }) => {
    await openNav(page, "Orders");
    await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /Refunded/ }).click();
    await page.getByRole("button", { name: /^Open order \d+/ }).first().click();

    const payments = page.getByRole("region", { name: "Payments" });
    await expect(payments).toBeVisible();
    await expect(payments.getByText("They changed their mind")).toBeVisible();
    // The disposition is the part that matters, so it is on the screen and not
    // only in the database.
    await expect(payments.getByText(/2 × Styro Block 2 inch — back on the shelf/)).toBeVisible();

    expectClean();
  });

  test("giving money back names the goods and what happens to them", async ({ page }) => {
    await openShortOrder(page);

    // Rule 6: in the order's Payments panel, never a red icon in a row.
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
    await page.getByRole("button", { name: "Give money back" }).click();

    await expect(page.getByRole("heading", { name: /Give money back on order/ })).toBeVisible();

    // Nothing is refunded until a quantity is put in, and the disposition is
    // only asked once something is actually coming back.
    await expect(page.getByRole("radio", { name: /Back on the shelf/ })).toHaveCount(0);
    await page.getByRole("spinbutton").first().fill("2");
    await expect(page.getByRole("radio", { name: /Back on the shelf/ })).toBeVisible();
    await expect(
      page.getByText(/Broken, or carved to a shape nobody else will buy/)
    ).toBeVisible();

    // The button says the verb and the amount, not "Confirm".
    await expect(page.getByRole("button", { name: /Give back ₱/ })).toBeVisible();

    expectClean();
  });

  test("fixing a price shows both figures and says which way it moved", async ({ page }) => {
    await openShortOrder(page);

    await page.getByRole("button", { name: "Fix the price" }).click();
    await expect(page.getByRole("heading", { name: /Fix the price on order/ })).toBeVisible();
    await expect(page.getByText("What they were told")).toBeVisible();

    const total = page.getByRole("spinbutton").first();
    await total.fill("3500");
    await expect(page.getByText(/more than they were told/)).toBeVisible();

    await total.fill("2500");
    await expect(page.getByText(/too much was charged/)).toBeVisible();

    // The reason is required — a total that moves with no reason reads as a
    // mistake a month later.
    await page.getByRole("button", { name: "Save the new price" }).click();
    await expect(page.getByText(/Say why the price changed/)).toBeVisible();

    await page.getByRole("radio", { name: /A discount the owner agreed/ }).click();
    await page.getByRole("button", { name: "Save the new price" }).click();
    await expect(page.getByText(/is now ₱2,500/)).toBeVisible();

    expectClean();
  });
});

test.describe("people", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL);
  });

  test("a supplier can be removed, in its own block, with a named confirm", async ({ page }) => {
    await openNav(page, "Suppliers");
    // The row opens the design's side panel; "View supplier" opens the full screen.
    await page.getByRole("button", { name: "Open Davao Foam Supply" }).click();
    await page.getByRole("button", { name: "View supplier" }).click();

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

  test("a customer with an order still waiting cannot be removed, and is told why", async ({
    page,
  }) => {
    await openNav(page, "Customers");
    // The row opens the design's side panel; "View customer" opens the full screen.
    await page.getByRole("button", { name: "Open Reyes Events" }).click();
    await page.getByRole("button", { name: "View customer" }).click();

    // The block still renders — it explains the refusal rather than vanishing,
    // because "why can't I delete this" deserves an answer on the screen.
    await expect(
      page.getByRole("heading", { name: "Remove this customer for good" })
    ).toBeVisible();
    await expect(page.getByText(/still owe goods to/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Remove Reyes Events/ })).toHaveCount(0);

    expectClean();
  });

  test("removing a customer keeps their past orders", async ({ page }) => {
    await openNav(page, "Customers");
    await page.getByRole("button", { name: "Open Bloom & Co" }).click();
    await page.getByRole("button", { name: "View customer" }).click();

    // Nothing waiting, so removal is offered and the copy promises the orders
    // survive -- `orders` holds the name as text with no foreign key.
    await expect(page.getByText(/Their past orders stay/)).toBeVisible();
    await page.getByRole("button", { name: "Remove Bloom & Co" }).click();

    await expect(page.getByRole("heading", { name: "Remove Bloom & Co?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, remove them" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
    // Scoped to <main>: the success toast names them too, and sonner renders
    // each toast as a list item in a portal outside the content area. That is
    // the toast doing its job, not the customer still being on the list.
    await expect(
      page.getByRole("main").getByRole("table").getByText("Bloom & Co")
    ).toHaveCount(0);

    // The promise the copy makes, actually checked.
    await openNav(page, "Orders");
    await expect(page.getByRole("table").getByText("Bloom & Co")).toBeVisible();

    expectClean();
  });

  test("customers have call-list filters", async ({ page }) => {
    await openNav(page, "Customers");

    const show = page.getByRole("group", { name: "Show" });
    await expect(show.getByRole("button", { name: /Not ordered in a year/ })).toBeVisible();
    await expect(show.getByRole("button", { name: /Businesses/ })).toBeVisible();
    await expect(page.getByRole("table").getByText("Business", { exact: true }).first()).toBeVisible();

    expectClean();
  });

  test("staff accounts answer 'can sign in', and removal lives in its own block", async ({
    page,
  }) => {
    await openNav(page, "User Management");

    await expect(page.getByRole("columnheader", { name: "Can sign in" })).toBeVisible();
    // The design calls a blocked account "Suspended".
    await expect(page.getByRole("table").getByText("Suspended").first()).toBeVisible();
    // Rule 6: no bare destructive icon in a row; the row's actions are words in a menu.
    await page.getByRole("button", { name: "Actions for Ana Reyes" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit details" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("table").getByRole("button", { name: "Ana Reyes", exact: true }).click();

    await expect(page.getByRole("switch", { name: "Can sign in" })).not.toBeChecked();
    await expect(page.getByText(/Their password still works/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Remove Ana's account" })).toBeVisible();

    expectClean();
  });

  test("a destructive confirm names the record and says what survives", async ({ page }) => {
    await openNav(page, "User Management");
    await page.getByRole("table").getByRole("button", { name: "Ana Reyes", exact: true }).click();
    await page.getByRole("button", { name: "Remove account" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Remove Ana Reyes?")).toBeVisible();
    await expect(dialog.getByText(/stay exactly as they are/)).toBeVisible();
    await expect(dialog.getByText(/cannot be undone/)).toBeVisible();
    // The verb, not "OK"; and the dismissing button is positive.
    await expect(dialog.getByRole("button", { name: "Yes, remove them" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep it" })).toBeVisible();

    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    expectClean();
  });

  test("changing a role spells out what each one unlocks", async ({ page }) => {
    await openNav(page, "User Management");
    await page.getByRole("button", { name: "Actions for Juan Dela Cruz" }).click();
    await page.getByRole("menuitem", { name: "Change role" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Change Juan's role" })).toBeVisible();
    await expect(page.getByText(/Writes orders and looks after customers/)).toBeVisible();
    await expect(page.getByText(/Works from the Production screen/)).toBeVisible();

    expectClean();
  });

  test("the activity log is real entries, grouped by day", async ({ page }) => {
    // The design files the activity log under Settings.
    await openNav(page, "Activity log");

    await expect(page.getByRole("heading", { level: 1, name: "Activity log" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Today" })).toBeVisible();
    await expect(page.getByText(/recorded 60 × Styro Ball 4 inch made/)).toBeVisible();
    // A row written in the pre-overhaul shape still renders.
    await expect(page.getByText(/Deleted order #1039/)).toBeVisible();

    expectClean();
  });
});

test.describe("what a role is not offered", () => {
  // No beforeEach sign-in in this block: each case signs in AS the role it is
  // about, and signing in twice would land the second attempt on a dashboard
  // with no sign-in form to fill.

  test("sales staff are not offered the money block", async ({ page, baseURL }) => {
    // Refunding and re-pricing are an administrator's or a manager's job. The
    // guard trigger on public.orders is the real gate; this checks the screen
    // agrees with it rather than offering a button the database would refuse.
    await stubSupabase(page, { as: "juan@lsbhandicrafts.test" });
    await signIn(page, baseURL, "juan@lsbhandicrafts.test");

    await openNav(page, "Orders");
    await page.getByRole("button", { name: /^Open order \d+/ }).first().click();

    // The ordinary forward action is still theirs — writing orders and moving
    // them along is the job. Only the money is not.
    await expect(page.getByRole("button", { name: "Mark as done" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Give money back" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Fix the price" })).toHaveCount(0);

    expectClean();
  });

  test("a non-manager sees the supplier but not the way to change or remove them", async ({
    page,
    baseURL,
  }) => {
    // Sales Staff reach suppliers -- knowing who to ring for materials is
    // everyone's job -- but managing the supplier list is a manager's, as
    // ordering from them already was. The RLS policies on public.suppliers are
    // the real gate; this checks the screen agrees with them rather than
    // offering a button the database would refuse.
    //
    // Re-stubbed as Juan: the route registered here takes precedence over the
    // administrator stub from the top-level beforeEach.
    await stubSupabase(page, { as: "juan@lsbhandicrafts.test" });
    await signIn(page, baseURL, "juan@lsbhandicrafts.test");

    await openNav(page, "Suppliers");
    await page.getByRole("button", { name: "Open Davao Foam Supply" }).click();
    await page.getByRole("button", { name: "View supplier" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Davao Foam Supply" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit details" })).toHaveCount(0);

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

  // The admin dashboard design sets the floors: 13px tables and meta text,
  // 12px captions and badges, 32px controls with 28px compact ones (row
  // actions, pagination). The old 16px / 44px floors were the previous
  // overhaul's and were deliberately replaced.
  test("nothing readable is under 12px and no control is under 28px", async ({ page }) => {
    await openNav(page, "Inventory");
    await page.getByRole("row").last().waitFor();
    // Measured once the screen has finished arriving.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));

    const findings = await page.evaluate(() => {
      // Monospace identifiers and keyboard hints are matched character by
      // character rather than read as words.
      const isExempt = (el) => getComputedStyle(el).fontFamily.includes("mono") || el.closest("kbd") !== null;

      const small = [];
      for (const el of document.querySelectorAll("main *")) {
        const text = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join("");
        if (text.length < 4) continue;
        if (isExempt(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 12) small.push({ text: text.slice(0, 40), size });
      }

      // Checkboxes, radios and switches are drawn at 16-18px on purpose, and a
      // text link is a run of text, not a control box.
      const tiny = [];
      const controls = 'main button:not([role="checkbox"]):not([role="radio"]):not([role="switch"]):not([data-slot="text-link"]), '
        + 'main input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), main select';
      for (const el of document.querySelectorAll(controls)) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue; // visually hidden (a select's form value)
        if (r.height < 27.5) tiny.push({ label: (el.textContent || el.type).slice(0, 40), h: Math.round(r.height) });
      }

      return { small, tiny };
    });

    expect(findings.small, JSON.stringify(findings.small, null, 2)).toEqual([]);
    expect(findings.tiny, JSON.stringify(findings.tiny, null, 2)).toEqual([]);
    expectClean();
  });

  test("every icon has a word beside it", async ({ page }) => {
    await openNav(page, "Inventory");

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
    await openNav(page, "Inventory");

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
  // The design's sidebar becomes a sheet on a phone (below 768px), opened from
  // the top bar's toggle, and full width with its labels from 768px up.
  test("a phone gets the sidebar as a sheet — never a sideways scroll", async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, baseURL);

    await expect(page.getByRole("complementary", { name: "Main navigation" })).toBeHidden();
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    const sheet = page.getByRole("dialog", { name: "Navigation" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /^Inventory/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflows, "the page scrolls sideways on a phone").toBe(false);

    expectClean();
  });

  test("a tablet keeps the sidebar, with a word beside every icon", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await signIn(page, baseURL);

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    await expect(nav.getByText("Inventory", { exact: true })).toBeVisible();

    expectClean();
  });
});
