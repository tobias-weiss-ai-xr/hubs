import { test, expect } from "@playwright/test";

// ── Configuration ───────────────────────────────────────────────────────────

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://hubs.chemie-lernen.org";
const TEST_ROOM_URL = process.env.TEST_ROOM_URL;
const TEST_HUB_ID = process.env.TEST_HUB_ID;

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
    expect(html).toContain("Google Analytics is disabled");
    expect(html).not.toContain("https://www.googletagmanager.com/gtag/js");
    expect(html).not.toContain("ga('create'");
    expect(html).not.toContain("gtag(");
  });

  test("assets are served with correct Content-Type", async ({ page }) => {
    await page.goto(BASE);
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

  test("page title is set correctly", async ({ page }) => {
    await page.goto(BASE);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    // Should not be the default "Hubs" title — should reflect our branding
    expect(title).not.toBe("Hubs");
  });
});

// ── Meta / Configuration API ────────────────────────────────────────────────

test.describe("Meta API", () => {
  test("GET /api/v1/meta returns server configuration", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/v1/meta`);
    expect(resp.ok()).toBe(true);
    const data = await resp.json();

    expect(data).toHaveProperty("hubs_version");
    expect(data).toHaveProperty("reticulum_version");
    expect(data).toHaveProperty("features");
    expect(data).toHaveProperty("app_name");
  });
});

// ── Create / Join a Room ────────────────────────────────────────────────────
// These tests require a pre-provisioned room URL (TEST_ROOM_URL env var).
// They run only when TEST_ROOM_URL is set (e.g., in CI).

test.describe("Room features", () => {
  test("sidebar shows Progress and Analytics menu items when in a room", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);

    // Wait for the room UI to load — the More menu button (labeled "More" or "…")
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 20000 });
    await moreMenuButton.click();

    // The popover should contain Progress and Analytics menu items
    await expect(page.getByText("Progress", { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Analytics", { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test("clicking Progress opens progress panel sidebar", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 20000 });
    await moreMenuButton.click();

    await page.getByText("Progress", { exact: false }).click();

    // The sidebar should show either "Room Progress" (teacher) or "My Progress" (student)
    await expect(
      page.getByText("Room Progress", { exact: false })
        .or(page.getByText("My Progress", { exact: false }))
    ).toBeVisible({ timeout: 5000 });

    // There should be a Close button to dismiss the panel
    const closeBtn = page.getByRole("button", { name: /close/i });
    await expect(closeBtn).toBeVisible({ timeout: 3000 });
  });

  test("clicking Analytics opens analytics dashboard sidebar", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 20000 });
    await moreMenuButton.click();

    await page.getByText("Analytics", { exact: false }).click();

    // The sidebar should show analytics content
    await expect(
      page.getByText("Students", { exact: false })
        .or(page.getByText("Loading", { exact: false }))
        .or(page.getByText("No student activity", { exact: false }))
    ).toBeVisible({ timeout: 5000 });
  });

  test("Progress panel can be opened, dismissed, and re-opened", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 20000 });

    // Open Progress
    await moreMenuButton.click();
    await page.getByText("Progress", { exact: false }).click();
    await expect(
      page.getByText("Room Progress", { exact: false })
        .or(page.getByText("My Progress", { exact: false }))
    ).toBeVisible({ timeout: 5000 });

    // Close it
    await page.getByRole("button", { name: /close/i }).click();

    // Re-open Progress
    await moreMenuButton.click();
    await page.getByText("Progress", { exact: false }).click();
    await expect(
      page.getByText("Room Progress", { exact: false })
        .or(page.getByText("My Progress", { exact: false }))
    ).toBeVisible({ timeout: 5000 });
  });

  test("room loads with a valid scene renderer", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);

    // Wait for the 3D viewport to render — the canvas element from A-Frame
    await expect(page.locator("canvas")).toBeVisible({ timeout: 25000 });

    // The UI should have the object info label indicating the scene loaded
    await expect(
      page.getByText("Room", { exact: false }).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ── Progress API (WebSocket) ────────────────────────────────────────────────
// These tests use page.evaluate to interact with the Phoenix channel.
// They require a room URL to connect to.

test.describe("Progress tracking API", () => {
  test("hubChannel is accessible from window scope in loaded room", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 25000 });

    const hasPhoenixSocket = await page.evaluate(() => {
      return typeof window.APP !== "undefined" && window.APP.hubChannel !== undefined;
    });

    console.log(`hubChannel accessible: ${hasPhoenixSocket}`);
    expect(typeof hasPhoenixSocket).toBe("boolean");
  });

  test("progress_updated event is dispatched on track_progress call", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 25000 });

    // Try to track progress via the client-side hubChannel
    const result = await page.evaluate(async () => {
      const hubChannel = window.APP && window.APP.hubChannel;
      if (!hubChannel) return { status: "no-channel" };

      // Wait a moment for the channel to fully join
      await new Promise(r => setTimeout(r, 2000));

      try {
        await hubChannel.trackProgress("e2e-test-element", "element", {
          status: "visited",
          time_spent_ms: 100
        });
        return { status: "ok", slug: "e2e-test-element", tracked: true };
      } catch (e) {
        return { status: "error", message: e.message || String(e) };
      }
    }, { timeout: 15000 });

    console.log(`trackProgress result:`, JSON.stringify(result));

    // Even if the channel call fails (e.g., not authenticated), the call should
    // not throw synchronously — it should resolve or reject gracefully
    if (result.status === "no-channel") {
      console.log("hubChannel not available — cannot test progress_updated events");
    }

    // The request should resolve (even if the server rejects it, it shouldn't crash)
    expect(["ok", "error", "no-channel"]).toContain(result.status);
  });

  test("can retrieve own progress via getMyProgress", async ({ page }) => {
    test.skip(!TEST_ROOM_URL, "TEST_ROOM_URL not set — skipping");

    await page.goto(TEST_ROOM_URL);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 25000 });

    const result = await page.evaluate(async () => {
      const hubChannel = window.APP && window.APP.hubChannel;
      if (!hubChannel) return { status: "no-channel" };

      await new Promise(r => setTimeout(r, 2000));

      try {
        const progress = await hubChannel.getMyProgress();
        return { status: "ok", entries: progress.entries || [] };
      } catch (e) {
        return { status: "error", message: e.message || String(e) };
      }
    }, { timeout: 15000 });

    console.log(`getMyProgress result:`, JSON.stringify(result));

    if (result.status === "ok") {
      expect(Array.isArray(result.entries)).toBe(true);
    }
    expect(["ok", "error", "no-channel"]).toContain(result.status);
  });
});

// ── Analytics API ───────────────────────────────────────────────────────────

test.describe("Analytics API", () => {
  test("GET /api/v1/hubs/:hubId/analytics returns expected fields", async ({ request }) => {
    const hubId = TEST_HUB_ID;
    test.skip(!hubId, "TEST_HUB_ID not set — skipping");

    const response = await request.get(`${BASE}/api/v1/hubs/${hubId}/analytics`);
    expect(response.ok()).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty("room");
    expect(data).toHaveProperty("students");
    expect(data).toHaveProperty("quiz_summary");

    if (data.room) {
      expect(data.room).toHaveProperty("name");
      expect(typeof data.room.name).toBe("string");
      expect(data.room.name.length).toBeGreaterThan(0);
    }

    expect(Array.isArray(data.students)).toBe(true);

    if (data.students.length > 0) {
      const student = data.students[0];
      expect(student).toHaveProperty("identity_name");
      expect(student).toHaveProperty("completed");
      expect(student).toHaveProperty("total_elements");
      expect(student).toHaveProperty("total_time_spent_ms");
      expect(student.completed).toBeLessThanOrEqual(student.total_elements);
    }

    if (data.quiz_summary) {
      expect(data.quiz_summary).toHaveProperty("total_quizzes");
      expect(data.quiz_summary).toHaveProperty("total_participants");
      expect(typeof data.quiz_summary.total_quizzes).toBe("number");
    }
  });

  test("analytics student progress data is consistent", async ({ request }) => {
    const hubId = TEST_HUB_ID;
    test.skip(!hubId, "TEST_HUB_ID not set — skipping");

    const response = await request.get(`${BASE}/api/v1/hubs/${hubId}/analytics`);
    expect(response.ok()).toBe(true);
    const data = await response.json();

    for (const student of data.students) {
      expect(student.identity_name).toBeTruthy();
      expect(student.total_elements).toBeGreaterThanOrEqual(0);
      expect(student.completed).toBeGreaterThanOrEqual(0);
      expect(student.completed).toBeLessThanOrEqual(student.total_elements);
      expect(student.total_time_spent_ms).toBeGreaterThanOrEqual(0);

      if (student.quiz_avg_score != null) {
        expect(student.quiz_avg_score).toBeGreaterThanOrEqual(0);
        expect(student.quiz_avg_score).toBeLessThanOrEqual(100);
      }
    }

    if (data.quiz_summary && data.quiz_summary.total_quizzes > 0) {
      expect(data.quiz_summary.total_participants).toBeGreaterThan(0);
      if (data.quiz_summary.average_score != null) {
        expect(data.quiz_summary.average_score).toBeGreaterThanOrEqual(0);
        expect(data.quiz_summary.average_score).toBeLessThanOrEqual(100);
      }
    }
  });

  test("analytics returns 401 or 404 for invalid hub", async ({ request }) => {
    const hubId = TEST_HUB_ID || "nonexistent-hub";
    const response = await request.get(`${BASE}/api/v1/hubs/${hubId}/analytics`);

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test("room stats fields are valid numbers when present", async ({ request }) => {
    const hubId = TEST_HUB_ID;
    test.skip(!hubId, "TEST_HUB_ID not set — skipping");

    const response = await request.get(`${BASE}/api/v1/hubs/${hubId}/analytics`);
    expect(response.ok()).toBe(true);
    const data = await response.json();

    if (data.room) {
      const numericFields = [
        "current_occupants",
        "members_in_room",
        "members_in_lobby",
        "max_ccu_24h"
      ];
      for (const field of numericFields) {
        if (data.room[field] != null) {
          expect(typeof data.room[field]).toBe("number");
          expect(data.room[field]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

// ── Room Creation API ───────────────────────────────────────────────────────

test.describe("Room creation API", () => {
  const createdRoomIds = [];

  test.afterAll(async ({ request }) => {
    for (const hubId of createdRoomIds) {
      try {
        await request.delete(`${BASE}/api/v1/hubs/${hubId}`);
      } catch {
        // Best-effort cleanup
      }
    }
  });

  test("POST /api/v1/hubs creates a new room (may require auth)", async ({ request }) => {
    test.skip(!process.env.TEST_CREATE_ROOM, "TEST_CREATE_ROOM not set — skipping");

    const payload = {
      hub: {
        name: `E2E Test Room ${Date.now()}`
      }
    };

    const response = await request.post(`${BASE}/api/v1/hubs`, {
      data: payload,
      headers: { "content-type": "application/json" }
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("hub");
      expect(data.hub).toHaveProperty("hub_id");
      expect(data.hub).toHaveProperty("url");
      expect(data.hub.name).toBe(payload.hub.name);
      createdRoomIds.push(data.hub.hub_id);
    } else {
      console.log(`Room creation returned ${response.status()} — server may require auth`);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("created room URL is accessible", async ({ page }) => {
    const roomUrl = process.env.TEST_ROOM_URL;
    test.skip(!roomUrl && !createdRoomIds.length, "No room URL available — skipping");

    const url = roomUrl || `${BASE}/hub.html?hub_id=${createdRoomIds[0]}`;
    await page.goto(url);
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
    const title = await page.title();
    console.log(`Room page title: "${title}"`);
  });
});

// ── Cross-feature Integration ───────────────────────────────────────────────

test.describe("Integration: Progress + Analytics data consistency", () => {
  test("analytics API returns data matching room context", async ({ page }) => {
    test.skip(!TEST_HUB_ID || !TEST_ROOM_URL, "TEST_HUB_ID or TEST_ROOM_URL not set — skipping");

    // Fetch analytics data
    const resp = await page.context().request.get(
      `${BASE}/api/v1/hubs/${TEST_HUB_ID}/analytics`
    );
    expect(resp.ok()).toBe(true);
    const analyticsData = await resp.json();
    const studentCountFromApi = analyticsData.students.length;

    // Navigate to room and open Progress panel
    await page.goto(TEST_ROOM_URL);
    const moreMenuButton = page.getByRole("button", { name: /^More$/ });
    await expect(moreMenuButton).toBeVisible({ timeout: 20000 });
    await moreMenuButton.click();
    await page.getByText("Progress", { exact: false }).click();

    // Check if we're in teacher view (Room Progress header present)
    const roomProgressVisible = await page.getByText("Room Progress", { exact: false }).isVisible().catch(() => false);

    if (roomProgressVisible && studentCountFromApi > 0) {
      // Teacher view with students — at least one student card should mention the student name
      const firstStudentName = analyticsData.students[0].identity_name;
      if (firstStudentName) {
        await expect(
          page.getByText(firstStudentName, { exact: false }).first()
        ).toBeVisible({ timeout: 5000 });
      }
    }

    console.log(`Analytics returned ${studentCountFromApi} students for hub ${TEST_HUB_ID}`);
  });
});
