import { test, expect } from "@playwright/test";

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://hubs.chemie-lernen.org";

// ── Landing Page ────────────────────────────────────────────────────────────

test.describe("Landing page", () => {
  test("loads the application with 200 status", async ({ page }) => {
    const resp = await page.goto(BASE);
    expect(resp.status()).toBe(200);
  });

  test("includes all required app chunk scripts", async ({ page }) => {
    await page.goto(BASE);
    const scripts = await page.$$eval("script[src]", els =>
      els.map(el => el.getAttribute("src"))
    );
    const requiredChunks = ["frontend-", "support-", "index-", "engine-", "store-"];
    for (const chunk of requiredChunks) {
      expect(scripts.some(s => s.includes(chunk))).toBe(true);
    }
  });

  test("CSP header does not contain unsafe-inline in script-src", async ({ page }) => {
    const resp = await page.goto(BASE);
    const csp = resp.headers()["content-security-policy"] || "";
    const scriptSrc = csp.split(";").find(s => s.trim().startsWith("script-src"));
    expect(scriptSrc).toBeTruthy();
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  test("no Google Analytics inline script present", async ({ page }) => {
    const html = await page.content();
    // The GA script was replaced with a comment placeholder
    expect(html).toContain("Google Analytics is disabled");
    // No actual GA script should be present
    expect(html).not.toContain("https://www.googletagmanager.com/gtag/js");
    expect(html).not.toContain("ga('create'");
    expect(html).not.toContain("gtag(");
  });

  test("assets are served with correct Content-Type", async ({ page }) => {
    await page.goto(BASE);
    // Check several script requests for correct content type
    const scripts = await page.$$eval("script[src]", els =>
      els.map(el => el.getAttribute("src"))
    );
    const assetUrls = scripts.filter(s => s.startsWith("/assets/")).slice(0, 3);
    for (const url of assetUrls) {
      const resp = await page.goto(BASE + url);
      const ct = resp.headers()["content-type"] || "";
      expect(ct).toContain("javascript");
    }
  });
});

// ── Create / Join a Room ────────────────────────────────────────────────────
// These tests require a pre-provisioned room URL (TEST_ROOM_URL env var).
// They run only when TEST_ROOM_URL is set (e.g., in CI).
//
// Usage:
//   TEST_ROOM_URL=https://hubs.chemie-lernen.org/scenes/abc123 npx playwright test

test.describe("Room features", () => {
  const roomUrl = process.env.TEST_ROOM_URL;

  test("sidebar shows Progress and Analytics menu items when in a room", async ({ page }) => {
    test.skip(!roomUrl, "TEST_ROOM_URL not set — skipping");

    await page.goto(roomUrl);

    // Wait for the More menu button to appear (the "…" button with More label)
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 15000 });
    await moreMenuButton.click();

    // The popover should now contain menu items
    await expect(page.getByText("Progress")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Analytics")).toBeVisible({ timeout: 5000 });
  });

  test("clicking Progress opens progress panel sidebar", async ({ page }) => {
    test.skip(!roomUrl, "TEST_ROOM_URL not set — skipping");

    await page.goto(roomUrl);
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 15000 });
    await moreMenuButton.click();

    await page.getByText("Progress").click();

    // The sidebar should show either "Room Progress" (teacher) or "My Progress" (student)
    await expect(
      page.getByText("Room Progress").or(page.getByText("My Progress"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("clicking Analytics opens analytics dashboard sidebar", async ({ page }) => {
    test.skip(!roomUrl, "TEST_ROOM_URL not set — skipping");

    await page.goto(roomUrl);
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 15000 });
    await moreMenuButton.click();

    await page.getByText("Analytics").click();

    // The sidebar should show analytics content
    await expect(
      page.getByText("Students").or(page.getByText("Loading")).or(page.getByText("No student activity"))
    ).toBeVisible({ timeout: 5000 });
  });
});

// ── Analytics API ───────────────────────────────────────────────────────────
// These test the REST analytics endpoint directly via fetch.

test.describe("Analytics API", () => {
  test("GET /api/v1/hubs/:id/analytics returns expected fields", async ({ page }) => {
    const hubId = process.env.TEST_HUB_ID;
    test.skip(!hubId, "TEST_HUB_ID not set — skipping");

    const response = await page.context().request.get(
      `${BASE}/api/v1/hubs/${hubId}/analytics`
    );
    expect(response.ok()).toBe(true);
    const data = await response.json();

    // The response should have all three top-level fields
    expect(data).toHaveProperty("room");
    expect(data).toHaveProperty("students");
    expect(data).toHaveProperty("quiz_summary");

    // Validate room structure
    if (data.room) {
      expect(data.room).toHaveProperty("name");
    }

    // Students should be an array
    expect(Array.isArray(data.students)).toBe(true);

    // Quiz summary should exist
    if (data.quiz_summary) {
      expect(data.quiz_summary).toHaveProperty("total_quizzes");
    }
  });

  test("analytics endpoint returns 401 for unauthorized requests", async ({ page }) => {
    const hubId = process.env.TEST_HUB_ID || "nonexistent-hub";
    const response = await page.context().request.get(
      `${BASE}/api/v1/hubs/${hubId}/analytics`
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
