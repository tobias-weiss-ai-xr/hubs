/* eslint-disable react/prop-types */
import test from "ava";
import React from "react";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import ProgressPanel from "../../../src/react-components/room/ProgressPanel";
import useProgressTracker from "../../../src/react-components/room/hooks/useProgressTracker";

test.beforeEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

// ── Shared channel mock with persistent storage ────────────────────────────

function createPersistentChannel() {
  const channel = {
    _entries: [],
    _progressHandlers: [],
    _trackerHandlers: [],
    /** Called by useProgressTracker.track() — stores the tracking data */
    trackProgress(slug, type, data) {
      const existing = this._entries.find(e => e.element_slug === slug);
      if (existing) {
        Object.assign(existing, { element_type: type, ...data });
      } else {
        this._entries.push({ element_slug: slug, element_type: type, ...data });
      }
      return Promise.resolve();
    },

    /** Called by ProgressPanel.StudentView — returns stored entries */
    getMyProgress() {
      return Promise.resolve({ entries: [...this._entries] });
    },

    /** Subscribed by ProgressPanel — fires after trackProgress to trigger re-fetch */
    onProgressUpdated(handler) {
      if (!this._progressHandlers.includes(handler)) {
        this._progressHandlers.push(handler);
      }
    },

    /** Notify all progress-updated handlers */
    notifyProgressUpdated() {
      const handlers = [...this._progressHandlers];
      handlers.forEach(h => h());
    }
  };
  return channel;
}

// ── Test helpers ───────────────────────────────────────────────────────────

function byText(text) {
  return screen.getByText(text, { exact: false });
}

function byTextMaybe(text) {
  return screen.queryByText(text, { exact: false });
}

async function flush() {
  await act(() => Promise.resolve());
}

function wrap(ui) {
  return React.createElement(IntlProvider, { locale: "en" }, ui);
}

// ── Test component that wires the hook + panel ─────────────────────────────

function TestHarness({ channel }) {
  // Simulate being on the "nacl" element page
  useProgressTracker(channel, "nacl", "element");

  return React.createElement(ProgressPanel, {
    channel,
    isTeacher: false,
    onClose: () => {}
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.serial("hook tracks started status + panel displays it after update event", async t => {
  const channel = createPersistentChannel();

  render(wrap(React.createElement(TestHarness, { channel })));

  // Panel loaded with empty data
  await waitFor(() => t.truthy(byText("0/0")));

  // The hook should have called trackProgress for "nacl" with status "started"
  t.is(channel._entries.length, 1, "one entry was tracked");
  t.is(channel._entries[0].element_slug, "nacl");
  t.is(channel._entries[0].status, "started");

  // Simulate the server emitting a progress-update event
  await act(() => channel.notifyProgressUpdated());
  await flush();

  // Now the panel should see 1 entry (still "started", so 0/1 completed)
  t.truthy(byText("nacl"));
  t.truthy(byText("In Progress")); // STATUS_LABEL.started = "In Progress"
  t.truthy(byText("0/1"));
  t.falsy(byTextMaybe("1/1"));
});

test.serial("hook tracks completed status after element change", async t => {
  const channel = createPersistentChannel();

  // Helper to render a component with useProgressTracker + ProgressPanel
  function renderWithTracker(slug) {
    return render(
      wrap(
        React.createElement(() => {
          useProgressTracker(channel, slug, "element");
          return React.createElement(ProgressPanel, {
            channel,
            isTeacher: false,
            onClose: () => {}
          });
        })
      )
    );
  }

  // First render: on "nacl"
  renderWithTracker("nacl");

  await waitFor(() => t.truthy(byText("0/0")));
  await flush();

  // Unmount the first component so its cleanup runs (tracks nacl as "visited")
  cleanup();
  document.body.innerHTML = "";
  await flush();

  // Now there should be 1 entry: nacl marked as visited with time_spent_ms
  t.is(channel._entries.length, 1, "nacl tracked after unmount");

  const naclEntry = channel._entries.find(e => e.element_slug === "nacl");
  t.is(naclEntry.status, "visited", "previous element marked visited on unmount");
  t.truthy(naclEntry.time_spent_ms >= 0, "time_spent_ms recorded for nacl");

  // Second render: on "h2o" — this should track h2o as "started"
  renderWithTracker("h2o");
  await flush();

  t.is(channel._entries.length, 2, "second entry tracked");
  const h2oEntry = channel._entries.find(e => e.element_slug === "h2o");
  t.is(h2oEntry.status, "started", "new element marked started");

  // Fire progress update so panel re-fetches
  await act(() => channel.notifyProgressUpdated());
  await flush();

  t.truthy(byText("h2o"));
  // Both nacl (visited) + h2o (started) show in the panel
  // so total = 2, completed = 0
  t.truthy(byText("0/2"));
});

test.serial("channel data flows through hook → storage → panel correctly", async t => {
  const channel = createPersistentChannel();

  render(wrap(React.createElement(TestHarness, { channel })));

  // Initial empty state
  await waitFor(() => t.truthy(byText("0/0")));
  t.is(channel._entries.length, 1, "nacl tracked as started");

  // Simulate a server-side progress event with additional entries
  channel._entries.push({
    element_slug: "quiz-abc",
    element_type: "quiz",
    status: "completed",
    score: 80,
    max_score: 100,
    time_spent_ms: 45000
  });

  await act(() => channel.notifyProgressUpdated());
  await flush();

  // Panel should now show both entries
  t.truthy(byText("nacl"));
  t.truthy(byText("quiz-abc"));
  // nacl=started, quiz-abc=completed → 1/2
  t.truthy(byText("1/2"));
  t.truthy(byText("80/100"));
  t.truthy(byText("45s"));
});
