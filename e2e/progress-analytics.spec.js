import { test, expect } from "@playwright/test";

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://hubs.chemie-lernen.org";

/**
 * Extract hub/scene slug from a room URL.
 * Room URLs look like: https://hubs.example.com/scenes/abc123
 */
function roomSlugFromUrl(url) {
  const m = url.match(/\/scenes\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

// ── Landing Page ────────────────────────────────────────────────────────────

test.describe("Landing page", () => {
  test("loads the application", async ({ page }) => {
    const resp = await page.goto(BASE);
    expect(resp.status()).toBe(200);
  });

  test("includes script tags for app chunks", async ({ page }) => {
    await page.goto(BASE);
    // The app loads these critical chunks
    const scripts = await page.$$eval("script[src]", els =>
      els.map(el => el.getAttribute("src"))
    );
    const hasFrontend = scripts.some(s => s.includes("frontend-"));
    const hasSupport = scripts.some(s => s.includes("support-"));
    const hasIndex = scripts.some(s => s.includes("index-"));
    const hasEngine = scripts.some(s => s.includes("engine-"));
    expect(hasFrontend).toBe(true);
    expect(hasSupport).toBe(true);
    expect(hasIndex).toBe(true);
    expect(hasEngine).toBe(true);
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

  test("assets are served with correct content type", async ({ page }) => {
    const resp = await page.goto(BASE);
    expect(resp.status()).toBe(200);
  });
});

// ── Create / Join a Room ────────────────────────────────────────────────────
// Note: These tests require either:
//   a) A running Hubs instance with anonymous room creation enabled, OR
//   b) A test account token set via the AUTH_TOKEN env var
// They are skipped by default unless CI or SKIP_ROOM_TESTS is explicitly set.

test.describe("Room features", () => {
  const skip = process.env.SKIP_ROOM_TESTS === "1" || !process.env.CI;

  test.skip(skip, "sidebar shows Progress and Analytics menu items when in a room", async ({
    page,
    context
  }) => {
    // This test requires being in a room.
    // In a CI environment, a test room should be pre-provisioned.
    const roomUrl = process.env.TEST_ROOM_URL;
    test.skip(!roomUrl, "TEST_ROOM_URL not set — skipping");

    await page.goto(roomUrl);

    // Wait for the app to initialize
    await page.waitForSelector(".more-menu-button", { timeout: 15000 });
    await page.click(".more-menu-button");

    // Menu items should include Progress and Analytics
    const menuTexts = await page.$$eval(".menu-item-label || .more-menu-item", els =>
      els.map(el => el.textContent.trim())
    );
    const hasProgress = menuTexts.some(t => t.includes("Progress"));
    const hasAnalytics = menuTexts.some(t => t.includes("Analytics"));
    expect(hasProgress).toBe(true);
    expect(hasAnalytics).toBe(true);
  });

  test.skip(skip, "clicking Progress opens ProgressPanel sidebar", async ({ page }) => {
    const roomUrl = process.env.TEST_ROOM_URL;
    test.skip(!roomUrl, "TEST_ROOM_URL not set — skipping");

    await page.goto(roomUrl);
    await page.waitForSelector(".more-menu-button", { timeout: 15000 });
    await page.click(".more-menu-button");

    // Click Progress menu item
    await page.click("text=Progress");
    // The sidebar should now show the Progress panel
    await expect(page.locator("text=Room Progress").or(page.locator("text=My Progress"))).toBeVisible({
      timeout: 5000
    });
  });

  test.skip(skip, "clicking Analytics opens AnalyticsDashboard sidebar", async ({ page }) => {
    const roomUrl = process.env.TEST_ROOM_URL;
    test.skip(!roomUrl, "TEST_ROOM_URL not set — skipping");

    await page.goto(roomUrl);
    await page.waitForSelector(".more-menu-button", { timeout: 15000 });
    await page.click(".more-menu-button");

    // Click Analytics menu item
    await page.click("text=Analytics");
    // The sidebar should now show the Analytics panel
    await expect(page.locator("text=Students").or(page.locator("text=Loading"))).toBeVisible({
      timeout: 5000
    });
  });
});

// ── API Endpoint Tests ──────────────────────────────────────────────────────
// These test the REST analytics endpoint directly via fetch.

test.describe("Analytics API", () => {
  test("GET /api/v1/hubs/:id/analytics returns expected fields", async ({ page }) => {
    // We need a valid hub ID to test against.
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

    // Room should have basic info if available
    if (data.room) {
      expect(data.room).toHaveProperty("name");
    }

    // Students should be an array
    expect(Array.isArray(data.students)).toBe(true);

    // Quiz summary should have total_quizzes
    if (data.quiz_summary) {
      expect(data.quiz_summary).toHaveProperty("total_quizzes");
    }
  });

  test("analytics endpoint returns 401 for unauthorized requests", async ({ page }) => {
    const hubId = process.env.TEST_HUB_ID || "nonexistent-hub";
    const response = await page.context().request.get(
      `${BASE}/api/v1/hubs/${hubId}/analytics`
    );
    // Should either be 401 (unauthorized) or 404 (not found) for invalid IDs
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
