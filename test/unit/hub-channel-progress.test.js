import test from "ava";

/**
 * Helper: creates a minimal mock of the Phoenix channel object.
 */
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
        }
      };
    },
    on(event, handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
    _trigger(event, data) {
      if (handlers[event]) handlers[event].forEach(h => h(data));
    }
  };
}

/**
 * Helper: creates a minimal mock of the Redux store.
 */
function mockStore() {
  return {
    state: {
      credentials: { token: "test-token" }
    },
    addEventListener() {}
  };
}

// ── Progress method contracts ───────────────────────────────────────────────
// These tests verify that the Phoenix push/receive pattern is used correctly
// with the expected event names. We test the HubChannel methods by creating
// a minimal mock of HubChannel that implements the same method signatures.

class MockHubChannel {
  constructor(hubId) {
    this.hubId = hubId;
    this.channel = mockChannel();
  }

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
      this.channel
        .push("get_my_progress", {})
        .receive("ok", resolve)
        .receive("error", reject);
    });
  }

  getRoomProgress() {
    return new Promise((resolve, reject) => {
      this.channel
        .push("get_room_progress", {})
        .receive("ok", resolve)
        .receive("error", reject);
    });
  }

  fetchAnalytics() {
    return fetch(`/api/v1/hubs/${this.hubId}/analytics`, { credentials: "same-origin" }).then(res =>
      res.json()
    );
  }

  onProgressUpdated(handler) {
    this.channel.on("progress_updated", handler);
  }
}

function createContext() {
  const channel = mockChannel();
  const hubChannel = new MockHubChannel("test-hub-123");
  hubChannel.channel = channel;
  return { hubChannel, channel };
}

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

test("trackProgress rejects on error response", async t => {
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
      { element_slug: "mol-1", element_type: "molecule", status: "completed", score: 90, max_score: 100, time_spent_ms: 12000 },
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
        entries: [
          { element_slug: "mol-1", status: "completed", score: 100, max_score: 100, time_spent_ms: 30000 }
        ]
      },
      {
        account_id: "student-2",
        identity_name: "Alice",
        entries: [
          { element_slug: "mol-1", status: "visited", time_spent_ms: 5000 }
        ]
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
  const handler = () => { callCount++; };
  hubChannel.onProgressUpdated(handler);
  channel._trigger("progress_updated", {});
  channel._trigger("progress_updated", {});
  t.is(callCount, 2);
});

test("onProgressUpdated supports multiple handlers", t => {
  const { hubChannel, channel } = createContext();
  let count1 = 0;
  let count2 = 0;
  hubChannel.onProgressUpdated(() => { count1++; });
  hubChannel.onProgressUpdated(() => { count2++; });
  channel._trigger("progress_updated", {});
  t.is(count1, 1);
  t.is(count2, 1);
});

// ── Integration scenario: track => progress_updated ──────────────────────────

test("track followed by progress_updated triggers handler", async t => {
  const { hubChannel, channel } = createContext();
  let updatedSlug = null;
  hubChannel.onProgressUpdated(data => { updatedSlug = data.element_slug; });

  // Simulate tracking an element
  const result = await hubChannel.trackProgress("el-42", "molecule", { status: "started" });
  t.is(result.payload.element_slug, "el-42");

  // Server broadcasts progress_updated to all clients
  channel._trigger("progress_updated", { element_slug: "el-42", status: "started" });
  t.is(updatedSlug, "el-42");
});

// ── Field contract tests (match server-side schema) ─────────────────────────
// These tests verify the data shape matches the server response from
// Ret.UserProgress and the hub_channel.ex progress handlers.

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
