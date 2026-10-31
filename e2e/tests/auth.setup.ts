import { test as setup, expect } from "@playwright/test";
import { ACCOUNTS } from "../env";

/** Signs each demo account in once through the real login form and keeps the session. */
const sessions = [
  { key: "buyer", account: ACCOUNTS.buyer, lands: /\/$|\/orders|\/messages|\/search/ },
  { key: "vendor", account: ACCOUNTS.vendor, lands: /\/vendor\// },
  { key: "newVendor", account: ACCOUNTS.newVendor, lands: /\/vendor\// },
] as const;

for (const { key, account, lands } of sessions) {
  setup(`sign in ${key}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("input-email").fill(account.email);
    await page.getByTestId("input-password").fill(account.password);
    await page.getByTestId("btn-submit-login").click();
    await expect(page).toHaveURL(lands);
    await page.context().storageState({ path: `.auth/${key}.json` });
  });
}
