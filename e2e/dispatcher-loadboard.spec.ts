import { test, expect } from "@playwright/test"

const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD

test.describe("Dispatcher E2E smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run E2E tests")

    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "TigerHawk TMS" })).toBeVisible()

    await page.getByLabel("Email Address").fill(email as string)
    await page.getByLabel("Password").fill(password as string)
    await page.getByRole("button", { name: "Sign In" }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("login + load board route is reachable", async ({ page }) => {
    await page.goto("/dashboard/dispatcher")

    await expect(page).toHaveURL(/\/dashboard\/dispatcher$/)
    await expect(page.getByText("Load Summary").first()).toBeVisible()
  })

  test("port houston smoke: vessels view renders sync control", async ({ page }) => {
    await page.goto("/dashboard/vessels")

    await expect(page).toHaveURL(/\/dashboard\/vessels$/)
    await expect(page.getByRole("heading", { name: "Vessel Tracking" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sync Now" })).toBeVisible()
  })
})
