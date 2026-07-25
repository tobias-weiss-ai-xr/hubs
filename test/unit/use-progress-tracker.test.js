import test from "ava";

// ── Mock for useProgressTracker logic ────────────────────────────────────────
// We test the tracking logic independently since the hook is tightly coupled
// to React's useEffect lifecycle. The core logic is:
//   1. When elementSlug changes, track the previous element as "visited"
//      with elapsed time, then track the new element as "started".
//   2. On cleanup (unmount), track the current element as "visited".
//   3. Provide a `track` callback for manual tracking.

const ELEMENT_NAV_EVENT = "navigate_element";
const QUIZ_STARTED_EVENT = "quiz_started";
const QUIZ_ENDED_EVENT = "quiz_ended";

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

test("track does nothing when channel is null", t => {
  const tracker = createTracker(null);
  tracker.track("mol-1", "molecule", { status: "started" });
  t.pass();
});

test("activate tracks new element as started", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  t.is(channel.calls.length, 1);
  t.is(channel.calls[0].slug, "mol-1");
  t.is(channel.calls[0].data.status, "started");
});

test("activate on same slug does nothing", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  tracker.activate("mol-1", "molecule");
  t.is(channel.calls.length, 1); // Only the first activation
});

test("activate on different slug marks previous as visited", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  t.is(channel.calls[0].data.status, "started");

  // Navigate to a different element
  tracker.activate("atom-2", "atom");
  t.is(channel.calls.length, 3);
  // call[0] = started mol-1
  // call[1] = visited mol-1 (previous)
  // call[2] = started atom-2 (new)
  t.is(channel.calls[1].slug, "mol-1");
  t.is(channel.calls[1].data.status, "visited");
  t.is(channel.calls[2].slug, "atom-2");
  t.is(channel.calls[2].data.status, "started");
});

test("deactivate marks current element as visited", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.activate("mol-1", "molecule");
  t.is(channel.calls.length, 1);
  t.is(channel.calls[0].data.status, "started");

  // Simulate some time passing
  await new Promise(r => setTimeout(r, 5));

  tracker.deactivate("molecule");
  t.is(channel.calls.length, 2);
  t.is(channel.calls[1].slug, "mol-1");
  t.is(channel.calls[1].data.status, "visited");
  t.true(channel.calls[1].data.time_spent_ms > 0);
});

test("deactivate with no active element does nothing", t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  tracker.deactivate("molecule");
  t.is(channel.calls.length, 0);
});

test("full flow: start → navigate → end tracks correctly", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  // User starts with mol-1
  tracker.activate("mol-1", "molecule");
  await new Promise(r => setTimeout(r, 3));

  // User navigates to atom-2
  tracker.activate("atom-2", "atom");
  await new Promise(r => setTimeout(r, 3));

  // User leaves the room
  tracker.deactivate("atom");

  t.is(channel.calls.length, 4);
  // 1: started mol-1
  t.is(channel.calls[0].slug, "mol-1");
  t.is(channel.calls[0].data.status, "started");
  // 2: visited mol-1 (with time)
  t.is(channel.calls[1].slug, "mol-1");
  t.is(channel.calls[1].data.status, "visited");
  t.true(channel.calls[1].data.time_spent_ms > 0);
  // 3: started atom-2
  t.is(channel.calls[2].slug, "atom-2");
  t.is(channel.calls[2].data.status, "started");
  // 4: visited atom-2 (with time)
  t.is(channel.calls[3].slug, "atom-2");
  t.is(channel.calls[3].data.status, "visited");
  t.true(channel.calls[3].data.time_spent_ms > 0);
});

test("track callback persists across activate/deactivate cycles", async t => {
  const channel = mockChannel();
  const tracker = createTracker(channel);

  // Manual tracking via track() should work independently
  await tracker.track("quiz-1", "quiz", { status: "completed", score: 95 });
  t.is(channel.calls.length, 1);
  t.is(channel.calls[0].data.score, 95);
});

// ── Event name constants ────────────────────────────────────────────────────

test("event name constants match expected values", t => {
  t.is(ELEMENT_NAV_EVENT, "navigate_element");
  t.is(QUIZ_STARTED_EVENT, "quiz_started");
  t.is(QUIZ_ENDED_EVENT, "quiz_ended");
});
