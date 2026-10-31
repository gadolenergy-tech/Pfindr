import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { apiAs, apiData, uid, type Item } from "../fixtures/helpers";

/**
 * Buyer <-> vendor messaging. A buyer asks about a sold-out product from its
 * page, the vendor answers from the vendor inbox, and each side sees the other's
 * message, unread counts, and nothing that is not theirs.
 */
test.describe.configure({ mode: "serial" });

const RUN = uid();
const NAME = `Cold Chain Vaccine Box ${RUN}`;
const SUBJECT = `Enquiry: ${NAME}`;

let buyerCtx: BrowserContext;
let vendorCtx: BrowserContext;
let buyer: Page;
let vendor: Page;
let item: Item;

type Thread = { id: string; subject: string; unread: number; counterpart: { name: string }; lastMessage: { body: string; fromMe: boolean } | null };

/** A message bubble in the open thread (the inbox list also previews the last message, so plain text would match twice). */
const bubble = (page: Page, text: string | RegExp) => page.locator("div.whitespace-pre-wrap").filter({ hasText: text });

const threadsOf = async (who: "buyer" | "vendor") =>
  apiData<Thread[]>(await (await apiAs(who)).get("conversations?limit=100"));
const unreadOf = async (who: "buyer" | "vendor") =>
  (await apiData<{ unread: number }>(await (await apiAs(who)).get("conversations/unread-count"))).unread;

test.beforeAll(async ({ browser }) => {
  buyerCtx = await browser.newContext({ storageState: ".auth/buyer.json" });
  vendorCtx = await browser.newContext({ storageState: ".auth/vendor.json" });
  buyer = await buyerCtx.newPage();
  vendor = await vendorCtx.newPage();
  const api = await apiAs("vendor");
  item = await apiData<Item>(
    await api.post("inventory", { data: { name: NAME, sku: `VX-${RUN}`, brand: "Cold Co", quantity: 0, price: 9000, unit: "box" } }),
    201,
  );
});

test.afterAll(async () => {
  await buyerCtx.close();
  await vendorCtx.close();
});

test("a buyer starts a conversation from a product that is out of stock", async () => {
  await buyer.goto(`/product/${item.id}`);
  await expect(buyer.getByText("This vendor is out of stock right now.")).toBeVisible();
  await expect(buyer.getByTestId("product-add-to-cart")).toHaveCount(0); // nothing to buy
  await expect(async () => {
    await buyer.getByRole("button", { name: /Message vendor/ }).click();
    await expect(buyer.getByText("Message sent").first()).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(buyer.getByText("Citadel Pharmacy will reply in your Finder inbox.").first()).toBeVisible();

  const mine = (await threadsOf("buyer")).filter((t) => t.subject === SUBJECT);
  expect(mine).toHaveLength(1);
});

test("asking again about the same product reuses the thread instead of spamming a new one", async () => {
  const before = (await threadsOf("vendor")).filter((t) => t.subject === SUBJECT);
  expect(before).toHaveLength(1);
  const buyerApi = await apiAs("buyer");
  const res = await buyerApi.post("conversations", {
    data: { vendorId: item.vendorId ?? (await vendorIdOf(item)), subject: SUBJECT, body: "Any update on stock?" },
  });
  const body = await apiData<{ id: string; reused: boolean }>(res, 201);
  expect(body.reused).toBe(true);
  const after = (await threadsOf("vendor")).filter((t) => t.subject === SUBJECT);
  expect(after).toHaveLength(1);
  expect(after[0]!.unread).toBe(2);
});

async function vendorIdOf(i: Item): Promise<string> {
  const api = await apiAs("vendor");
  return (await apiData<Item>(await api.get(`inventory/${i.id}`))).vendorId!;
}

test("the vendor is told there are unread messages and sees who wrote", async () => {
  expect(await unreadOf("vendor")).toBeGreaterThanOrEqual(2);
  await vendor.goto("/vendor/messages");
  const row = vendor.getByRole("button").filter({ hasText: SUBJECT });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Demo Buyer");
  await expect(row).toContainText("Any update on stock?");
});

test("opening the thread shows the whole exchange and clears the unread count", async () => {
  await vendor.getByRole("button").filter({ hasText: SUBJECT }).click();
  await expect(bubble(vendor, /I found .* on Finder and would like a price and availability/)).toBeVisible();
  await expect(bubble(vendor, "Any update on stock?")).toBeVisible();
  await expect.poll(async () => (await threadsOf("vendor")).find((t) => t.subject === SUBJECT)!.unread).toBe(0);
  // The buyer's own unread count is untouched by the vendor reading.
  expect((await threadsOf("buyer")).find((t) => t.subject === SUBJECT)!.unread).toBe(0);
});

test("the vendor replies; the buyer receives it with an unread marker", async () => {
  const input = vendor.getByPlaceholder("Type a message…");
  await expect(vendor.getByRole("button", { name: "Send" })).toBeDisabled(); // nothing typed yet
  await input.fill("   ");
  await expect(vendor.getByRole("button", { name: "Send" })).toBeDisabled(); // whitespace is not a message
  await input.fill("Yes, a fresh delivery arrives Friday. I will hold one for you.");
  await vendor.getByRole("button", { name: "Send" }).click();
  await expect(bubble(vendor, "Yes, a fresh delivery arrives Friday. I will hold one for you.")).toBeVisible();
  await expect(input).toHaveValue("");

  expect(await unreadOf("buyer")).toBe(1);
  await buyer.goto("/messages");
  const row = buyer.getByRole("button").filter({ hasText: SUBJECT });
  await expect(row).toContainText("Citadel Pharmacy");
  await expect(row).toContainText("fresh delivery arrives Friday");
});

test("the buyer reads it, replies, and the vendor sees it arrive without reloading", async () => {
  await buyer.getByRole("button").filter({ hasText: SUBJECT }).click();
  await expect(bubble(buyer, "Yes, a fresh delivery arrives Friday. I will hold one for you.")).toBeVisible();
  await expect.poll(() => unreadOf("buyer")).toBe(0);

  await buyer.getByPlaceholder("Type a message…").fill("Great, I will collect on Saturday.");
  await buyer.keyboard.press("Enter");
  await expect(bubble(buyer, "Great, I will collect on Saturday.")).toBeVisible();

  // The vendor's open thread picks it up on its own (the inbox polls every few seconds).
  await expect(bubble(vendor, "Great, I will collect on Saturday.")).toBeVisible({ timeout: 20_000 });
  // And the vendor's earlier reply now shows as read by the buyer.
  await expect(vendor.getByText(/· Read/).first()).toBeVisible({ timeout: 20_000 });
});

test("messages keep their order and line breaks, and markup is shown as text", async () => {
  const api = await apiAs("buyer");
  const convo = (await threadsOf("buyer")).find((t) => t.subject === SUBJECT)!;
  await apiData(await api.post(`conversations/${convo.id}/messages`, { data: { body: "<img src=x onerror=alert(1)> line one\nline two" } }), 201);
  await buyer.reload();
  await buyer.getByRole("button").filter({ hasText: SUBJECT }).click();
  await expect(bubble(buyer, "<img src=x onerror=alert(1)>")).toBeVisible();
  await expect(buyer.locator("img[src='x']")).toHaveCount(0); // not rendered as HTML
  const texts = await buyer.locator("div.whitespace-pre-wrap").allInnerTexts();
  expect(texts.findIndex((t) => t.includes("Yes, a fresh delivery"))).toBeLessThan(texts.findIndex((t) => t.includes("Great, I will collect")));
  expect(texts.findIndex((t) => t.includes("Great, I will collect"))).toBeLessThan(texts.findIndex((t) => t.includes("line one")));
});

test("a message over the limit is refused", async () => {
  const api = await apiAs("buyer");
  const convo = (await threadsOf("buyer")).find((t) => t.subject === SUBJECT)!;
  const res = await api.post(`conversations/${convo.id}/messages`, { data: { body: "x".repeat(5001) } });
  expect(res.status()).toBe(422);
  const empty = await api.post(`conversations/${convo.id}/messages`, { data: { body: "" } });
  expect(empty.status()).toBe(422);
});

test("nobody else can read or write into the conversation", async () => {
  const convo = (await threadsOf("buyer")).find((t) => t.subject === SUBJECT)!;
  const other = await apiAs("newVendor"); // a different vendor, and a different buyer-side account
  expect((await other.get(`conversations/${convo.id}`)).status()).toBe(403);
  expect((await other.post(`conversations/${convo.id}/messages`, { data: { body: "hi" } })).status()).toBe(403);
  expect((await other.patch(`conversations/${convo.id}/archive`)).status()).toBe(403);
  expect((await threadsOf("vendor")).some((t) => t.id === convo.id)).toBe(true);
  expect((await (await apiAs("newVendor")).get("conversations?limit=100").then((r) => r.json())).data.some((t: Thread) => t.id === convo.id)).toBe(false);
  // Unknown thread
  expect((await other.get("conversations/does-not-exist")).status()).toBe(404);
});

test("a vendor cannot message their own business, and cannot message a vendor that does not exist", async () => {
  const vendorApi = await apiAs("vendor");
  const res = await vendorApi.post("conversations", { data: { vendorId: await vendorIdOf(item), subject: "Self", body: "me" } });
  expect(res.status()).toBe(400);
  const buyerApi = await apiAs("buyer");
  const ghost = await buyerApi.post("conversations", { data: { vendorId: "nope", subject: "Ghost", body: "hello" } });
  expect(ghost.status()).toBe(404);
});

test("archiving hides the thread for the vendor, and a new message from the buyer brings it back", async () => {
  await vendor.reload();
  await vendor.waitForLoadState("networkidle");
  // The dev server hydrates late; retry the open-and-archive until the click lands.
  await expect(async () => {
    await vendor.getByRole("button").filter({ hasText: SUBJECT }).click();
    await vendor.getByTitle("Archive conversation").click({ timeout: 2000 });
    await expect(vendor.getByText("Conversation archived").first()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await expect(vendor.getByRole("button").filter({ hasText: SUBJECT })).toHaveCount(0);

  const convo = (await threadsOf("buyer")).find((t) => t.subject === SUBJECT);
  expect(convo, "the buyer's side is unaffected by the vendor archiving").toBeUndefined(); // archive is per thread, not per side
  // A fresh enquiry about the same product starts a new open thread the vendor can see.
  const buyerApi = await apiAs("buyer");
  await apiData(await buyerApi.post("conversations", { data: { vendorId: await vendorIdOf(item), subject: SUBJECT, body: "Is it back in stock?" } }), 201);
  expect((await threadsOf("vendor")).filter((t) => t.subject === SUBJECT)).toHaveLength(1);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: ".auth/buyer.json" });

  test("the buyer inbox fits the screen: nothing scrolls sideways and the message box is reachable", async ({ page }) => {
    await page.goto("/messages");
    const thread = page.getByRole("button").filter({ hasText: SUBJECT });
    await expect(thread).toBeVisible();
    await thread.click();
    const input = page.getByPlaceholder("Type a message…");
    await expect(input).toBeVisible();
    const box = (await input.boundingBox())!;
    const width = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));
    expect(width.doc, "page is wider than the phone screen").toBeLessThanOrEqual(width.view);
    expect(box.x + box.width, "message box runs off the right edge").toBeLessThanOrEqual(390);
    expect(box.width, "message box is squeezed to nothing").toBeGreaterThan(150);
    // One pane at a time: the thread is open, the list is out of the way, and Send is on screen.
    await expect(thread).toBeHidden();
    const send = (await page.getByRole("button", { name: "Send" }).boundingBox())!;
    expect(send.x + send.width).toBeLessThanOrEqual(390);

    // Back returns to the list.
    await page.getByRole("button", { name: "Back to conversations" }).click();
    await expect(thread).toBeVisible();
    await expect(input).toBeHidden();
  });
});
