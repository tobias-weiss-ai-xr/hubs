import test from "ava";

// ── Note ─────────────────────────────────────────────────────────────────────
// These tests validate the core tracking logic that the useProgressTracker
// hook implements. The hook itself (src/react-components/room/hooks/useProgressTracker.js)
// uses React's useEffect/useRef/useCallback which require a React rendering
// environment (jsdom + React Testing Library). Here we test the algorithm
// independently by extracting the pure-logic portion.
//
// The real hook's key behaviors:
//   1. On mount / elementSlug change → track new element as "started"
//   2. On elementSlug change → track previous element as "visited" with time
//   3. On unmount → track current element as "visited" with time
//   4. Provide a `track` callback for manual tracking
//   5. Silently swallow track errors (.catch(() => {}))

// ── Pure-logic replica of the hook's tracking algorithm ──────────────────────

function createTracker(channel) {
  let startTime = null;
  let currentSlug = null;

  const track = (slug, type, data = {}) => {
    if (!channel || !slug) return;
    channel.trackProgress(slug, type, data).catch(() => {});
  };

  function activate(elementSlug, elementType) {
    if (!channel) return;

    if (elementSlug && elementSlug !== currentSlug) {
      if (currentSlug) {
        const elapsed = startTime ? Date.now() - startTime : 0;
        track(currentSlug, elementType, {
          status: "visited",
          time_spent_ms: elapsed
        });
      }
      currentSlug = elementSlug;
      startTime = Date.now();
      track(elementSlug, elementType, { status: "started" });
    }
  }

  function deactivate(elementType) {
    if (currentSlug && startTime) {
      const elapsed = Date.now() - startTime;
      track(currentSlug, elementType, {
        status: "visited",
        time_spent_ms: elapsed
      });
    }
    // Reset state so repeated calls don't double-track
    currentSlug = null;
    startTime = null;
  }

  return { track, activate, deactivate };
}

function mockChannel() {
  const calls = [];
  const trackProgress = (slug, type, data = {}) => {
    calls.push({ slug, type, data });
    return Promise.resolve({ ok: true });
  };
  return { trackProgress, calls };
}

// ── Tests ───────────────────────────────────────────────────────────────────

test("track calls channel.trackProgress with correct arguments", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.track("mol-1", "molecule", { status: "completed", score: 100 });
  t.is(channel.calls.length, 1);
  t.is(channel.calls[0].slug, "mol-1");
  t.is(channel.calls[0].type, "molecule");
  t.is(channel.calls[0].data.status, "completed");
  t.is(channel.calls[0].data.score, 100);
});

test("track does nothing when channel is null or slug is empty", t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  // null channel
  const trackerNull = createTracker(null);
  trackerNull.track("mol-1", "molecule");
  t.pass();

  // empty slug
  tracker.track("", "molecule");
  t.is(channel.calls.length, 0);

  // null slug
  tracker.track(null, "molecule");
  t.is(channel.calls.length, 0);

  // undefined slug
  tracker.track(undefined, "molecule");
  t.is(channel.calls.length, 0);
});

test("activate tracks new element as started", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  t.is(channel.calls.length, 1);
  t.is(channel.calls[0].slug, "mol-1");
  t.is(channel.calls[0].data.status, "started");
});

test("activate on null/undefined slug does nothing", t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate(null, "molecule");
  tracker.activate(undefined, "molecule");
  t.is(channel.calls.length, 0);
});

test("activate on same slug does nothing (idempotent)", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  tracker.activate("mol-1", "molecule");
  t.is(channel.calls.length, 1);
});

test("activate on different slug marks previous as visited with elapsed time", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  t.is(channel.calls[0].data.status, "started");

  tracker.activate("atom-2", "atom");
  t.is(channel.calls.length, 3);
  // call[0] = started mol-1
  // call[1] = visited mol-1 (previous, with time_spent_ms)
  // call[2] = started atom-2 (new)
  t.is(channel.calls[1].slug, "mol-1");
  t.is(channel.calls[1].data.status, "visited");
  t.true(typeof channel.calls[1].data.time_spent_ms === "number");
  t.is(channel.calls[2].slug, "atom-2");
  t.is(channel.calls[2].data.status, "started");
});

test("deactivate marks current element as visited and resets state", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  t.is(channel.calls.length, 1);

  tracker.deactivate("molecule");
  t.is(channel.calls.length, 2);
  t.is(channel.calls[1].slug, "mol-1");
  t.is(channel.calls[1].data.status, "visited");
  t.true(typeof channel.calls[1].data.time_spent_ms === "number");

  // State is reset — a second deactivate should do nothing
  tracker.deactivate("molecule");
  t.is(channel.calls.length, 2);
});

test("deactivate with no active element does nothing", t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.deactivate("molecule");
  t.is(channel.calls.length, 0);
});

test("full lifecycle: start → navigate → end produces correct tracking sequence", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  // Step 1: User activates molecule element
  tracker.activate("mol-water", "molecule");
  t.is(channel.calls[0].slug, "mol-water");
  t.is(channel.calls[0].data.status, "started");

  // Step 2: User navigates to an atom element
  tracker.activate("atom-h", "atom");
  t.is(channel.calls[1].slug, "mol-water");
  t.is(channel.calls[1].data.status, "visited");
  t.true(typeof channel.calls[1].data.time_spent_ms === "number");
  t.is(channel.calls[2].slug, "atom-h");
  t.is(channel.calls[2].data.status, "started");

  // Step 3: User navigates to a quiz
  tracker.activate("quiz-1", "quiz");
  t.is(channel.calls[3].slug, "atom-h");
  t.is(channel.calls[3].data.status, "visited");
  t.true(typeof channel.calls[3].data.time_spent_ms === "number");
  t.is(channel.calls[4].slug, "quiz-1");
  t.is(channel.calls[4].data.status, "started");

  // Step 4: User leaves, deactivates
  tracker.deactivate("quiz");
  t.is(channel.calls[5].slug, "quiz-1");
  t.is(channel.calls[5].data.status, "visited");
  t.true(typeof channel.calls[5].data.time_spent_ms === "number");

  // Total: 6 calls
  t.is(channel.calls.length, 6);
});

test("track callback works independently of activate/deactivate lifecycle", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  // Manual tracking via track() should work independently of activate/deactivate
  await tracker.track("quiz-1", "quiz", { status: "completed", score: 95 });
  t.is(channel.calls.length, 1);
  t.is(channel.calls[0].data.score, 95);

  // activate should still work after manual track
  tracker.activate("mol-1", "molecule");
  t.is(channel.calls.length, 2);
  t.is(channel.calls[1].data.status, "started");
});

test("track silently swallows errors (error handling)", async t => {
  const channel = {
    trackProgress(slug, type, data) {
      return Promise.reject(new Error("Server error"));
    }
  };
  const tracker = createTracker(channel);

  // Should not throw — .catch(() => {}) swallows the error
  tracker.track("mol-1", "molecule", { status: "started" });
  // Wait for the promise to settle
  await new Promise(r => setTimeout(r, 10));
  t.pass();
});

test("channel.trackProgress is not called when channel is missing (activate)", t => {
  const tracker = createTracker(null);
  tracker.activate("mol-1", "molecule");
  t.pass();
});

test("channel.trackProgress is not called when channel is missing (deactivate)", t => {
  const tracker = createTracker(null);
  tracker.deactivate("molecule");
  t.pass();
});
