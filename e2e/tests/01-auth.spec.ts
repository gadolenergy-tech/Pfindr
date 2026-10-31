import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS } from "../env";
import { uid } from "../fixtures/helpers";

/**
 * Accounts and access: the show/hide password eye on every password field,
 * sign in / sign out, route guards for each role, buyer and vendor sign-up, and
 * the vendor settings that are deliberately switched off.
 */
test.use({ storageState: { cookies: [], origins: [] }, geolocation: { latitude: 4.8156, longitude: 7.0498 }, permissions: ["geolocation"] });
test.describe.configure({ mode: "serial" });

const RUN = uid();

/** Navigates and waits for the dev server to finish hydrating, so the first click or fill is not lost. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Presses Continue until the next step shows; a click before the dev server has hydrated the page is lost. */
async function continueUntil(page: Page, next: string) {
  await expect(async () => {
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator(next)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

/** Fills the business step of vendor sign-up, which needs the category list to have loaded. */
async function fillBusinessStep(page: Page, name: string, contact: string) {
  await open(page, "/vendor/signup");
  await page.locator("#businessName").fill(name);
  await page.getByRole("combobox").click();
  await page.getByRole("option").first().click();
  await page.locator("#fullName").fill(contact);
  await continueUntil(page, "#contactEmail");
}

/** The inline eye button that sits next to a password input, however the page wires it. */
const eyeFor = (page: Page, input: string) => page.locator(input).locator("xpath=following-sibling::button").first();

async function expectEyeToggles(page: Page, input: string) {
  const field = page.locator(input);
  await field.fill("Sup3r-Secret!");
  await expect(field).toHaveAttribute("type", "password");
  await eyeFor(page, input).click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(field).toHaveValue("Sup3r-Secret!"); // the typed value is untouched
  await eyeFor(page, input).click();
  await expect(field).toHaveAttribute("type", "password");
}

test.describe("show / hide password", () => {
  test("login", async ({ page }) => {
    await open(page, "/login");
    await expectEyeToggles(page, "#password");
  });

  test("buyer sign-up", async ({ page }) => {
    await open(page, "/signup/user");
    await expectEyeToggles(page, "#password");
  });

  test("reset password: one eye reveals both the new and the confirm field", async ({ page }) => {
    await open(page, "/reset-password?token=not-a-real-token");
    await page.locator("#confirm").fill("Sup3r-Secret!");
    await expectEyeToggles(page, "#password");
    await eyeFor(page, "#password").click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await expect(page.locator("#confirm")).toHaveAttribute("type", "text");
    await eyeFor(page, "#password").click();
    await expect(page.locator("#confirm")).toHaveAttribute("type", "password");
  });

  test("vendor sign-up: create and confirm password", async ({ page }) => {
    await fillBusinessStep(page, `Eye Test ${RUN}`, "Eye Tester");
    await page.locator("#contactEmail").fill(`eye-${RUN}@example.com`);
    await page.locator("#contactPhone").fill("+2348012345678");
    await page.locator("#addressLine1").fill("1 Test Street");
    await page.locator("#city").fill("Port Harcourt");
    await page.locator("#state").fill("Rivers");
    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(page.getByText(/4\.8156/)).toBeVisible();
    await continueUntil(page, "#password");

    for (const id of ["#password", "#confirmPassword"]) {
      const field = page.locator(id);
      await field.fill("Sup3r-Secret!");
      await expect(field).toHaveAttribute("type", "password");
      await field.locator("xpath=following-sibling::button").click();
      await expect(field).toHaveAttribute("type", "text");
      await field.locator("xpath=following-sibling::button").click();
      await expect(field).toHaveAttribute("type", "password");
    }
    // The toggle is a button, not a form submit: nothing was sent.
    await expect(page).toHaveURL(/\/vendor\/signup/);
  });

  test("the toggle is reachable by keyboard and labelled for screen readers (shared PasswordInput)", async ({ page }) => {
    await fillBusinessStep(page, `Kbd ${RUN}`, "Kbd Tester");
    await page.locator("#contactEmail").fill(`kbd-${RUN}@example.com`);
    await page.locator("#contactPhone").fill("+2348012345678");
    await page.locator("#addressLine1").fill("1 Test Street");
    await page.locator("#city").fill("Port Harcourt");
    await page.locator("#state").fill("Rivers");
    await page.getByRole("button", { name: "Use my current location" }).click();
    await continueUntil(page, "#password");
    const first = page.getByRole("button", { name: "Show password" }).first();
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("sign in and out", () => {
  test("empty form is not submitted", async ({ page }) => {
    await open(page, "/login");
    await page.getByTestId("btn-submit-login").click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("alert-login-error")).toHaveCount(0);
  });

  test("a wrong password and an unknown email give the same answer", async ({ page }) => {
    await open(page, "/login");
    await page.getByTestId("input-email").fill(ACCOUNTS.buyer.email);
    await page.getByTestId("input-password").fill("definitely-wrong");
    await page.getByTestId("btn-submit-login").click();
    const wrong = await page.getByTestId("alert-login-error").innerText();
    expect(wrong.length).toBeGreaterThan(5);

    await page.getByTestId("input-email").fill(`nobody-${RUN}@example.com`);
    await page.getByTestId("btn-submit-login").click();
    await expect(page.getByTestId("alert-login-error")).toHaveText(wrong); // no hint about which accounts exist
    await expect(page).toHaveURL(/\/login/);
  });

  test("a protected page sends a signed-out visitor to login and back afterwards", async ({ page }) => {
    await open(page, "/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    await page.getByTestId("input-email").fill(ACCOUNTS.buyer.email);
    await page.getByTestId("input-password").fill(ACCOUNTS.buyer.password);
    await page.getByTestId("btn-submit-login").click();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
  });

  test("signing out ends the session everywhere in the app", async ({ page }) => {
    await open(page, "/login");
    await page.getByTestId("input-email").fill(ACCOUNTS.buyer.email);
    await page.getByTestId("input-password").fill(ACCOUNTS.buyer.password);
    await page.getByTestId("btn-submit-login").click();
    await expect(page.getByTestId("btn-nav-logout")).toBeVisible();
    await page.getByTestId("btn-nav-logout").click();
    await expect(page.getByTestId("btn-nav-signup")).toBeVisible();
    await open(page, "/orders");
    await expect(page).toHaveURL(/\/login/);
    await open(page, "/cart");
    // The server session is gone too, not just the UI state.
    const me = await page.request.get("/api/proxy/auth/me");
    expect(me.status()).toBe(401);
  });

  test("signed-out visitors cannot open the vendor area", async ({ page }) => {
    await open(page, "/vendor/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fvendor%2Fdashboard/);
    await open(page, "/vendor/inventory");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a vendor signs in to the vendor dashboard", async ({ page }) => {
    await open(page, "/login");
    await page.getByTestId("input-email").fill(ACCOUNTS.vendor.email);
    await page.getByTestId("input-password").fill(ACCOUNTS.vendor.password);
    await page.getByTestId("btn-submit-login").click();
    await expect(page).toHaveURL(/\/vendor\//);
  });
});

test.describe("role guards", () => {
  test.use({ storageState: ".auth/buyer.json" });
  test("a buyer is turned away from vendor pages", async ({ page }) => {
    await open(page, "/vendor/inventory");
    await expect(page).toHaveURL(/localhost:3120\/$/);
    await expect(page.getByRole("heading", { name: "AI Inventory Sync Center" })).toHaveCount(0);
  });
  test("a buyer's session cannot call vendor APIs", async ({ page }) => {
    for (const path of ["inventory", "inventory/summary", "orders", "customers"]) {
      const res = await page.request.get(`/api/proxy/${path}`);
      expect([401, 403], `${path}: ${res.status()}`).toContain(res.status());
    }
  });
});

test.describe("sign-up", () => {
  const email = `buyer-${RUN.toLowerCase()}@example.com`;

  test("a buyer must accept the terms and choose a strong enough password", async ({ page }) => {
    const registerCalls: string[] = [];
    page.on("request", (r) => r.url().includes("/auth/register") && registerCalls.push(r.url()));
    await open(page, "/signup/user");
    await page.locator("#name").fill("New Buyer");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("Sup3r-Secret!");
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForTimeout(500);
    // The terms box is a required field, so the browser stops the form before anything is sent.
    await expect(page.getByText("Please check this box")).toHaveCount(0); // native bubble is not DOM text
    expect(registerCalls).toHaveLength(0);
    await expect(page).toHaveURL(/\/signup\/user/);

    await page.locator("#terms").click();
    await page.locator("#password").fill("short");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/signup\/user/);
    await expect(page.locator("p.text-destructive, [data-testid=alert-signup-error]").first()).toBeVisible();
  });

  test("a buyer creates an account and lands on email verification, already signed in", async ({ page }) => {
    await open(page, "/signup/user");
    await page.locator("#name").fill("New Buyer");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("Sup3r-Secret!");
    await page.locator("#terms").click();
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/verify-email/);
    const me = await page.request.get("/api/proxy/auth/me");
    expect(me.status()).toBe(200);
    const body = (await me.json()) as { data: { user: { email: string; role: string; emailVerified: boolean } } };
    expect(body.data.user).toMatchObject({ email, role: "USER", emailVerified: false });
  });

  test("the same email cannot register twice", async ({ page }) => {
    await open(page, "/signup/user");
    await page.locator("#name").fill("Copycat");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("Sup3r-Secret!");
    await page.locator("#terms").click();
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByTestId("alert-signup-error")).toBeVisible();
    await expect(page).toHaveURL(/\/signup\/user/);
  });

  test("forgot password gives the same confirmation whether or not the account exists", async ({ page }) => {
    const answers: string[] = [];
    for (const address of [ACCOUNTS.buyer.email, `ghost-${RUN}@example.com`]) {
      await open(page, "/forgot-password");
      await page.locator("#email").fill(address);
      await page.getByRole("button", { name: /send|reset/i }).first().click();
      await expect(page.getByText(/check your (email|inbox)|if an account/i).first()).toBeVisible();
      answers.push((await page.locator("main, body").first().innerText()).replace(/\S+@\S+/g, "<email>"));
    }
    expect(answers[0]).toBe(answers[1]);
  });
});

test.describe("vendor sign-up and settings", () => {
  const email = `vendor-${RUN.toLowerCase()}@example.com`;

  async function fillVendorForm(page: Page, { pin = true, confirm = "Sup3r-Secret!" } = {}) {
    await fillBusinessStep(page, `Fresh Vendor ${RUN}`, "Fresh Owner");
    await page.locator("#contactEmail").fill(email);
    await page.locator("#contactPhone").fill("+2348012345678");
    await page.locator("#addressLine1").fill("12 Market Road");
    await page.locator("#city").fill("Port Harcourt");
    await page.locator("#state").fill("Rivers");
    if (pin) await page.getByRole("button", { name: "Use my current location" }).click();
    await continueUntil(page, "#password");
    return confirm;
  }

  test("the shop location is required, because search ranks by distance", async ({ page }) => {
    await fillBusinessStep(page, `No Pin ${RUN}`, "No Pin");
    await page.locator("#contactEmail").fill(`nopin-${RUN}@example.com`);
    await page.locator("#contactPhone").fill("+2348012345678");
    await page.locator("#addressLine1").fill("1 Road");
    await page.locator("#city").fill("Port Harcourt");
    await page.locator("#state").fill("Rivers");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Pin your shop location so buyers nearby can find you.")).toBeVisible();
    await expect(page.locator("#password")).toHaveCount(0); // still on step 2
  });

  test("mismatched passwords are caught before anything is sent", async ({ page }) => {
    await fillVendorForm(page);
    await page.locator("#registrationNumber").fill("RC123456");
    await page.locator("#password").fill("Sup3r-Secret!");
    await page.locator("#confirmPassword").fill("Different-Secret1!");
    await page.getByRole("button", { name: /submit|create|register|apply/i }).last().click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page).toHaveURL(/\/vendor\/signup/);
  });

  test("a vendor registers, reaches the dashboard, and sees privacy controls switched off", async ({ page }) => {
    await fillVendorForm(page);
    await page.locator("#registrationNumber").fill("RC123456");
    await page.locator("#password").fill("Sup3r-Secret!");
    await page.locator("#confirmPassword").fill("Sup3r-Secret!");
    await page.getByRole("button", { name: /submit|create|register|apply/i }).last().click();
    await expect(page).toHaveURL(/\/vendor\/dashboard/);

    await open(page, "/vendor/settings");
    await page.getByRole("button", { name: "Privacy" }).first().click();
    await expect(page.getByText(/Privacy controls are paused for now/)).toBeVisible();
    // Every privacy switch is inert, and the save button is disabled.
    for (const label of ["Show Business on Finder Directory", "Show Inventory Quantities", "Show Pricing", "Allow Buyer Reviews", "Share Analytics with Finder"]) {
      const row = page.locator("div.rounded-xl").filter({ hasText: label }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText("Paused");
      await expect(row.getByRole("switch")).toBeDisabled();
    }
    await expect(page.getByRole("switch")).toHaveCount(5);
    for (const sw of await page.getByRole("switch").all()) await expect(sw).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save Privacy Settings" })).toBeDisabled();
  });

  test("the settings password form has an eye on each field and rejects a wrong current password", async ({ page }) => {
    await open(page, "/login");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill("Sup3r-Secret!");
    await page.getByTestId("btn-submit-login").click();
    await page.waitForURL(/\/vendor\//); // wait for the session cookie before navigating on
    await open(page, "/vendor/settings");
    await page.getByRole("button", { name: "Account Settings" }).first().click();
    const eyes = page.getByRole("button", { name: "Show password" });
    await expect(eyes).toHaveCount(3);
    const inputs = page.locator('input[autocomplete="current-password"], input[autocomplete="new-password"]');
    await inputs.nth(0).fill("Wrong-Current1!");
    await inputs.nth(1).fill("Brand-New-Pass1!");
    await inputs.nth(2).fill("Brand-New-Pass1!");
    await eyes.first().click();
    await expect(inputs.nth(0)).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.getByText(/incorrect|invalid|wrong|does not match/i).first()).toBeVisible();
    // Still signed in: a failed attempt does not log the vendor out.
    expect((await page.request.get("/api/proxy/auth/me")).status()).toBe(200);
  });
});
