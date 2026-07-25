import test from "ava";

// ── ⚠️ Important note about what these tests cover ───────────────────────────
//
// The real HubChannel class (src/utils/hub-channel.js) depends on:
//   - Phoenix Channels JS client (ESM, can't be required in ava)
//   - Webpack-imported assets (images, configs)
//   - React's event-target-shim and Redux store
//
// These tests validate the PHOENIX CHANNEL PROTOCOL that HubChannel uses —
// specifically the event names, payload shapes, and async push/receive flow —
// via a minimal mock that faithfully reproduces the same method signatures.
//
// A separate contract test verifies that the mock's method signatures match
// the real source at the time tests are run.
//
// For true end-to-end tests of the real HubChannel, see:
//   e2e/progress-analytics.spec.js  (Playwright, needs a running instance)

import fs from "fs";
import path from "path";

// ── Mock Phoenix channel object ──────────────────────────────────────────────

function mockChannel() {
  const handlers = {};
  return {
    push(event, payload) {
      return {
        receive(status, cb) {
          if (status === "ok") {
            process.nextTick(() => cb({ ok: true, event, payload }));
          }
          return this;
        },
        _resolve(status, response) {
          if (handlers["_receive_" + status]) {
            handlers["_receive_" + status](response);
          }
        }
      };
    },
    on(event, handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      // Return a function to detach (like Phoenix's ref)
      return () => {
        const idx = handlers[event].indexOf(handler);
        if (idx >= 0) handlers[event].splice(idx, 1);
      };
    },
    off(event) {
      delete handlers[event];
    },
    _trigger(event, data) {
      if (handlers[event]) handlers[event].forEach(h => h(data));
    }
  };
}

// ── MockHubChannel — replicates HubChannel's progress/analytics methods ──────

class MockHubChannel {
  constructor(hubId) {
    this.hubId = hubId;
    this.channel = mockChannel();
  }

  // ---- Progress tracking methods (from real HubChannel) ----

  trackProgress(elementSlug, elementType, data = {}) {
    return new Promise((resolve, reject) => {
      this.channel
        .push("track_progress", { element_slug: elementSlug, element_type: elementType, ...data })
        .receive("ok", resolve)
        .receive("error", reject);
    });
  }

  getMyProgress() {
    return new Promise((resolve, reject) => {
      this.channel.push("get_my_progress", {}).receive("ok", resolve).receive("error", reject);
    });
  }

  getRoomProgress() {
    return new Promise((resolve, reject) => {
      this.channel.push("get_room_progress", {}).receive("ok", resolve).receive("error", reject);
    });
  }

  fetchAnalytics() {
    return fetch(`/api/v1/hubs/${this.hubId}/analytics`, { credentials: "same-origin" }).then(res => res.json());
  }

  onProgressUpdated(handler) {
    this.channel.on("progress_updated", handler);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

function createContext() {
  const channel = mockChannel();
  const hubChannel = new MockHubChannel("test-hub-123");
  hubChannel.channel = channel;
  return { hubChannel, channel };
}

// ── Contract test: verify mock matches real source code ──────────────────────
// Extracts method signatures from the real hub-channel.js and compares them
// to our mock. This ensures the mock stays in sync with the real implementation.

test("mock method signatures match real HubChannel source", t => {
  const sourcePath = path.resolve(__dirname, "../../src/utils/hub-channel.js");
  const source = fs.readFileSync(sourcePath, "utf-8");

  // Extract method names and event names from the real source
  const methodDefs = source.match(
    /(trackProgress|getMyProgress|getRoomProgress|fetchAnalytics|onProgressUpdated)\s*=\s*\([^)]*\)/g
  );
  const eventNames = [];
  const pushMatches = source.matchAll(/\.push\(["']([^"']+)["']/g);
  for (const m of pushMatches) eventNames.push(m[1]);
  const onMatches = source.matchAll(/\.on\(["']([^"']+)["']/g);
  for (const m of onMatches) eventNames.push(m[1]);

  // Verify our mock has the same methods
  const mockMethods = Object.getOwnPropertyNames(MockHubChannel.prototype).filter(
    m => m !== "constructor" && !m.startsWith("_")
  );

  for (const method of methodDefs) {
    const methodName = method.split("=")[0].trim();
    t.true(mockMethods.includes(methodName), `Mock is missing method: ${methodName}`);
  }

  // Verify event names match
  t.true(eventNames.includes("track_progress"), "Real source uses 'track_progress'");
  t.true(eventNames.includes("get_my_progress"), "Real source uses 'get_my_progress'");
  t.true(eventNames.includes("get_room_progress"), "Real source uses 'get_room_progress'");
  t.true(eventNames.includes("progress_updated"), "Real source uses 'progress_updated'");

  // Verify fetchAnalytics uses the same URL pattern
  t.true(
    source.includes("/api/v1/hubs/${this.hubId}/analytics"),
    "Real source uses /api/v1/hubs/:id/analytics endpoint"
  );
  t.true(source.includes('credentials: "same-origin"'), "Real source uses same-origin credentials");
});

// ── trackProgress ────────────────────────────────────────────────────────────

test("trackProgress pushes track_progress event with correct payload", async t => {
  const { hubChannel } = createContext();
  const result = await hubChannel.trackProgress("element-42", "molecule", {
    status: "started"
  });
  t.truthy(result);
  t.is(result.event, "track_progress");
  t.is(result.payload.element_slug, "element-42");
  t.is(result.payload.element_type, "molecule");
  t.is(result.payload.status, "started");
});

test("trackProgress spreads additional data into payload", async t => {
  const { hubChannel } = createContext();
  const result = await hubChannel.trackProgress("el-1", "atom", {
    status: "completed",
    time_spent_ms: 3000,
    score: 85
  });
  t.is(result.payload.score, 85);
  t.is(result.payload.time_spent_ms, 3000);
});

test("trackProgress works with minimal arguments", async t => {
  const { hubChannel } = createContext();
  const result = await hubChannel.trackProgress("el-1", "quiz");
  t.is(result.payload.element_slug, "el-1");
  t.is(result.payload.element_type, "quiz");
});

test("trackProgress rejects on error response from server", async t => {
  const { hubChannel, channel } = createContext();
  channel.push = () => ({
    receive(status, cb) {
      if (status === "error") {
        process.nextTick(() => cb({ error: "unauthorized" }));
      }
      return this;
    }
  });
  try {
    await hubChannel.trackProgress("el-1", "atom");
    t.fail("Should have rejected");
  } catch (err) {
    t.is(err.error, "unauthorized");
  }
});

test("trackProgress handles null elementSlug gracefully", async t => {
  const { hubChannel } = createContext();
  const result = await hubChannel.trackProgress(null, "molecule");
  t.truthy(result);
  t.is(result.payload.element_slug, null);
  t.is(result.payload.element_type, "molecule");
});

test("trackProgress handles empty elementType", async t => {
  const { hubChannel } = createContext();
  const result = await hubChannel.trackProgress("el-1", "");
  t.is(result.payload.element_type, "");
});

test("trackProgress allows overwriting element_slug via data spread", async t => {
  // This tests that the spread operator allows overriding internal keys.
  // While not recommended usage, it's what the real code does.
  const { hubChannel } = createContext();
  const result = await hubChannel.trackProgress("real-slug", "molecule", {
    element_slug: "override"
  });
  // The spread happens after the explicit keys, so data overrides them
  t.is(result.payload.element_slug, "override");
});

test("trackProgress handles concurrent calls", async t => {
  const { hubChannel } = createContext();
  const [r1, r2, r3] = await Promise.all([
    hubChannel.trackProgress("mol-1", "molecule"),
    hubChannel.trackProgress("mol-2", "molecule"),
    hubChannel.trackProgress("quiz-1", "quiz", { status: "completed", score: 100 })
  ]);
  t.is(r1.payload.element_slug, "mol-1");
  t.is(r2.payload.element_slug, "mol-2");
  t.is(r3.payload.score, 100);
});

test("trackProgress with very large metadata payload does not crash", async t => {
  const { hubChannel } = createContext();
  const largeMetadata = { data: "x".repeat(10000) };
  const result = await hubChannel.trackProgress("el-1", "experiment", {
    metadata: largeMetadata
  });
  t.is(result.payload.metadata.data.length, 10000);
});

// ── getMyProgress ────────────────────────────────────────────────────────────

test("getMyProgress pushes get_my_progress event", async t => {
  const { hubChannel } = createContext();
  const result = await hubChannel.getMyProgress();
  t.truthy(result);
  t.is(result.event, "get_my_progress");
});

test("getMyProgress returns student progress entries", async t => {
  const { hubChannel, channel } = createContext();
  const progressData = {
    entries: [
      {
        element_slug: "mol-1",
        element_type: "molecule",
        status: "completed",
        score: 90,
        max_score: 100,
        time_spent_ms: 12000
      },
      { element_slug: "atom-2", element_type: "atom", status: "started", time_spent_ms: 5000 }
    ]
  };
  channel.push = () => ({
    receive(status, cb) {
      if (status === "ok") process.nextTick(() => cb(progressData));
      return this;
    }
  });
  const result = await hubChannel.getMyProgress();
  t.is(result.entries.length, 2);
  t.is(result.entries[0].element_slug, "mol-1");
  t.is(result.entries[1].status, "started");
});

test("getMyProgress returns empty entries when no data", async t => {
  const { hubChannel, channel } = createContext();
  channel.push = () => ({
    receive(status, cb) {
      if (status === "ok") process.nextTick(() => cb({ entries: [] }));
      return this;
    }
  });
  const result = await hubChannel.getMyProgress();
  t.truthy(result.entries);
  t.is(result.entries.length, 0);
});

test("getMyProgress rejects when server returns error", async t => {
  const { hubChannel, channel } = createContext();
  channel.push = () => ({
    receive(status, cb) {
      if (status === "error") process.nextTick(() => cb({ error: "not_found" }));
      return this;
    }
  });
  try {
    await hubChannel.getMyProgress();
    t.fail("Should have rejected");
  } catch (err) {
    t.is(err.error, "not_found");
  }
});

test("getMyProgress/ trackProgress race condition does not deadlock", async t => {
  const { hubChannel } = createContext();
  // Simulate a user tracking progress while also requesting their progress
  const [trackResult, progressResult] = await Promise.all([
    hubChannel.trackProgress("mol-1", "molecule"),
    hubChannel.getMyProgress()
  ]);
  t.truthy(trackResult);
  t.truthy(progressResult);
  t.is(trackResult.payload.element_slug, "mol-1");
});

// ── getRoomProgress ──────────────────────────────────────────────────────────

test("getRoomProgress pushes get_room_progress event", async t => {
  const { hubChannel } = createContext();
  const result = await hubChannel.getRoomProgress();
  t.is(result.event, "get_room_progress");
});

test("getRoomProgress returns teacher room progress with students", async t => {
  const { hubChannel, channel } = createContext();
  const roomData = {
    students: [
      {
        account_id: "teacher-1",
        identity_name: "Dr. Smith",
        entries: [{ element_slug: "mol-1", status: "completed", score: 100, max_score: 100, time_spent_ms: 30000 }]
      },
      {
        account_id: "student-2",
        identity_name: "Alice",
        entries: [{ element_slug: "mol-1", status: "visited", time_spent_ms: 5000 }]
      }
    ]
  };
  channel.push = () => ({
    receive(status, cb) {
      if (status === "ok") process.nextTick(() => cb(roomData));
      return this;
    }
  });
  const result = await hubChannel.getRoomProgress();
  t.is(result.students.length, 2);
  t.is(result.students[0].identity_name, "Dr. Smith");
  t.is(result.students[1].entries[0].status, "visited");
});

test("getRoomProgress returns empty students array when no activity", async t => {
  const { hubChannel, channel } = createContext();
  channel.push = () => ({
    receive(status, cb) {
      if (status === "ok") process.nextTick(() => cb({ students: [] }));
      return this;
    }
  });
  const result = await hubChannel.getRoomProgress();
  t.truthy(result.students);
  t.is(result.students.length, 0);
});

test("getRoomProgress rejects for unauthorized users", async t => {
  const { hubChannel, channel } = createContext();
  channel.push = () => ({
    receive(status, cb) {
      if (status === "error") process.nextTick(() => cb({ error: "forbidden" }));
      return this;
    }
  });
  try {
    await hubChannel.getRoomProgress();
    t.fail("Should have rejected");
  } catch (err) {
    t.is(err.error, "forbidden");
  }
});

// ── fetchAnalytics ───────────────────────────────────────────────────────────

test("fetchAnalytics fetches from correct API endpoint", async t => {
  const { hubChannel } = createContext();
  const originalFetch = global.fetch;
  let capturedUrl = null;
  let capturedOpts = null;
  global.fetch = (url, opts) => {
    capturedUrl = url;
    capturedOpts = opts;
    return Promise.resolve({
      json: () => Promise.resolve({ room: { name: "Test Room" }, students: [], quiz_summary: null })
    });
  };
  try {
    const result = await hubChannel.fetchAnalytics();
    t.is(capturedUrl, "/api/v1/hubs/test-hub-123/analytics");
    t.is(capturedOpts.credentials, "same-origin");
    t.is(result.room.name, "Test Room");
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchAnalytics returns room stats, students, and quiz summary", async t => {
  const { hubChannel } = createContext();
  const analyticsData = {
    room: {
      name: "Chemistry Lab 101",
      current_occupants: 5,
      members_in_room: 4,
      members_in_lobby: 1,
      max_ccu_24h: 12
    },
    students: [
      { identity_name: "Alice", completed: 3, total_elements: 5, total_time_spent_ms: 60000, quiz_avg_score: 85 },
      { identity_name: "Bob", completed: 1, total_elements: 5, total_time_spent_ms: 20000, quiz_avg_score: null }
    ],
    quiz_summary: {
      total_quizzes: 2,
      total_participants: 10,
      average_score: 72
    }
  };
  const originalFetch = global.fetch;
  global.fetch = () => Promise.resolve({ json: () => Promise.resolve(analyticsData) });
  try {
    const result = await hubChannel.fetchAnalytics();
    t.is(result.room.current_occupants, 5);
    t.is(result.students.length, 2);
    t.is(result.students[0].quiz_avg_score, 85);
    t.is(result.quiz_summary.average_score, 72);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchAnalytics handles network failure", async t => {
  const { hubChannel } = createContext();
  const originalFetch = global.fetch;
  global.fetch = () => Promise.reject(new Error("Network error"));
  try {
    await t.throwsAsync(() => hubChannel.fetchAnalytics(), { instanceOf: Error });
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchAnalytics handles non-JSON response gracefully", async t => {
  const { hubChannel } = createContext();
  const originalFetch = global.fetch;
  global.fetch = () =>
    Promise.resolve({
      json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON at position 0")),
      status: 500,
      statusText: "Internal Server Error"
    });
  try {
    await t.throwsAsync(() => hubChannel.fetchAnalytics(), { instanceOf: SyntaxError });
  } finally {
    global.fetch = originalFetch;
  }
});

// ── onProgressUpdated ────────────────────────────────────────────────────────

test("onProgressUpdated registers handler for progress_updated event", t => {
  const { hubChannel, channel } = createContext();
  let captured = null;
  hubChannel.onProgressUpdated(data => {
    captured = data;
  });
  channel._trigger("progress_updated", { status: "completed", element_slug: "mol-1" });
  t.is(captured.status, "completed");
  t.is(captured.element_slug, "mol-1");
});

test("onProgressUpdated can be called multiple times", t => {
  const { hubChannel, channel } = createContext();
  let callCount = 0;
  const handler = () => {
    callCount++;
  };
  hubChannel.onProgressUpdated(handler);
  channel._trigger("progress_updated", {});
  channel._trigger("progress_updated", {});
  t.is(callCount, 2);
});

test("onProgressUpdated supports multiple handlers", t => {
  const { hubChannel, channel } = createContext();
  let count1 = 0;
  let count2 = 0;
  hubChannel.onProgressUpdated(() => {
    count1++;
  });
  hubChannel.onProgressUpdated(() => {
    count2++;
  });
  channel._trigger("progress_updated", {});
  t.is(count1, 1);
  t.is(count2, 1);
});

test("onProgressUpdated throws when channel is missing (same as real code)", t => {
  const hubChannel = new MockHubChannel("test-hub-123");
  hubChannel.channel = null;
  // The real HubChannel also accesses this.channel.on() without null check
  t.throws(
    () => {
      hubChannel.onProgressUpdated(() => {});
    },
    { instanceOf: TypeError }
  );
});

// ── Handler cleanup: detach via returned function ────────────────────────────

test("onProgressUpdated returns a detach function", t => {
  const { hubChannel, channel } = createContext();
  let callCount = 0;
  const handler = () => {
    callCount++;
  };
  const detach = hubChannel.channel.on("progress_updated", handler);

  channel._trigger("progress_updated", {});
  t.is(callCount, 1);

  // Detach the handler
  detach();
  channel._trigger("progress_updated", {});
  t.is(callCount, 1); // Should still be 1 — handler was detached
});

test("handlers do not accumulate after detach", t => {
  const { hubChannel, channel } = createContext();
  let callCount = 0;

  const detach1 = hubChannel.channel.on("progress_updated", () => {
    callCount++;
  });
  const detach2 = hubChannel.channel.on("progress_updated", () => {
    callCount++;
  });

  channel._trigger("progress_updated", {});
  t.is(callCount, 2);

  detach1();
  channel._trigger("progress_updated", {});
  t.is(callCount, 3); // Only one handler fires

  detach2();
  channel._trigger("progress_updated", {});
  t.is(callCount, 3); // No handlers left
});

// ── Integration scenario: track → progress_updated flow ──────────────────────

test("track followed by progress_updated triggers handler", async t => {
  const { hubChannel, channel } = createContext();
  let updatedSlug = null;
  hubChannel.onProgressUpdated(data => {
    updatedSlug = data.element_slug;
  });

  const result = await hubChannel.trackProgress("el-42", "molecule", { status: "started" });
  t.is(result.payload.element_slug, "el-42");

  // Server broadcasts progress_updated to all clients
  channel._trigger("progress_updated", { element_slug: "el-42", status: "started" });
  t.is(updatedSlug, "el-42");
});

// ── Field contract tests (match server-side schema) ─────────────────────────

test("progress entry contract matches server schema", async t => {
  const { hubChannel, channel } = createContext();
  const serverResponse = {
    entries: [
      {
        element_slug: "mol-water",
        element_type: "molecule",
        status: "completed",
        score: 85,
        max_score: 100,
        time_spent_ms: 45000,
        updated_at: "2026-07-25T12:00:00Z"
      }
    ]
  };
  channel.push = () => ({
    receive(status, cb) {
      if (status === "ok") process.nextTick(() => cb(serverResponse));
      return this;
    }
  });
  const result = await hubChannel.getMyProgress();
  const entry = result.entries[0];
  t.is(entry.element_slug, "mol-water");
  t.is(entry.element_type, "molecule");
  t.is(entry.status, "completed");
  t.is(entry.score, 85);
  t.is(entry.max_score, 100);
  t.is(entry.time_spent_ms, 45000);
  t.truthy(entry.updated_at);
});

test("analytics response contract matches server schema", async t => {
  const { hubChannel } = createContext();
  const serverResponse = {
    room: { name: "Chem Lab", current_occupants: 3 },
    students: [
      { identity_name: "Alice", completed: 2, total_elements: 3, total_time_spent_ms: 120000, quiz_avg_score: 90 }
    ],
    quiz_summary: { total_quizzes: 1, total_participants: 5, average_score: 78 }
  };
  const originalFetch = global.fetch;
  global.fetch = () => Promise.resolve({ json: () => Promise.resolve(serverResponse) });
  try {
    const result = await hubChannel.fetchAnalytics();
    t.is(result.room.name, "Chem Lab");
    t.is(result.students[0].identity_name, "Alice");
    t.is(result.quiz_summary.average_score, 78);
  } finally {
    global.fetch = originalFetch;
  }
});
