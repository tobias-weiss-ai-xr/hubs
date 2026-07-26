import test from "ava";
import React from "react";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import ProgressPanel from "../../../src/react-components/room/ProgressPanel";

// Tests must run serially because they share the same DOM (jsdom).
// ava's default parallelism would cause DOM state leakage between tests.
test.beforeEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

// ── Helpers ────────────────────────────────────────────────────────────────

function renderWithProviders(ui) {
  return render(React.createElement(IntlProvider, { locale: "en" }, ui));
}

function createMockChannel(overrides = {}) {
  const defaults = {
    getMyProgress: () => Promise.resolve({ entries: [] }),
    getRoomProgress: () => Promise.resolve({ students: [] }),
    onProgressUpdated: () => {}
  };
  return { ...defaults, ...overrides };
}

async function flush() {
  await act(() => Promise.resolve());
}

async function waitForText(text, timeout = 2000) {
  return waitFor(() => screen.getByText(text, { exact: false }), { timeout });
}

function byText(text) {
  return screen.getByText(text, { exact: false });
}

function byTextMaybe(text) {
  return screen.queryByText(text, { exact: false });
}

// ── StudentView tests ─────────────────────────────────────────────────────

test.serial("StudentView shows empty state message", async t => {
  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries: [] })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("My Progress");
  t.truthy(byText("No progress yet"));
  t.truthy(byText("Close"));
});

test.serial("StudentView renders progress entries", async t => {
  const entries = [
    {
      element_slug: "h2o",
      element_type: "element",
      status: "completed",
      score: 100,
      max_score: 100,
      time_spent_ms: 5000
    },
    {
      element_slug: "nacl",
      element_type: "element",
      status: "visited",
      score: null,
      max_score: null,
      time_spent_ms: null
    }
  ];

  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("h2o");
  t.truthy(byText("nacl"));
  t.truthy(byText("100/100"));
  t.truthy(byText("Done"));
  t.truthy(byText("Visited"));
  t.truthy(byText("5s"));
  t.truthy(byText("My Progress"));
  t.truthy(byText("1/2"));
  t.truthy(byText("50%"));
});

test.serial("StudentView renders multi-minute time format", async t => {
  const entries = [
    {
      element_slug: "long-experiment",
      element_type: "experiment",
      status: "completed",
      score: 80,
      max_score: 100,
      time_spent_ms: 3723000
    }
  ];

  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("long-experiment");
  // 3723000ms = 62m 3s
  t.truthy(byText("62m 3s"));
});

test.serial("StudentView renders entry with zero time_spent_ms", async t => {
  const entries = [
    {
      element_slug: "instant-visit",
      element_type: "scene",
      status: "visited",
      score: null,
      max_score: null,
      time_spent_ms: 0
    }
  ];

  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("instant-visit");
  // 0ms → formatTime returns "" → no time element rendered
  t.falsy(byTextMaybe("0s"));
  // But the element name and status should still show
  t.truthy(byText("Visited"));
});

test.serial("StudentView subscribes to progress updates", async t => {
  let registeredHandler = null;
  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries: [] }),
    onProgressUpdated: handler => {
      registeredHandler = handler;
    }
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("My Progress");
  t.truthy(registeredHandler, "onProgressUpdated handler was registered");

  let getMyProgressCalled = false;
  channel.getMyProgress = () => {
    getMyProgressCalled = true;
    return Promise.resolve({ entries: [] });
  };

  await act(() => registeredHandler());
  await flush();
  t.truthy(getMyProgressCalled, "getMyProgress was called on progress update");
});

test.serial("StudentView handles getMyProgress error gracefully", async t => {
  const channel = createMockChannel({
    getMyProgress: () => Promise.reject(new Error("network failure"))
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("No progress yet");
  t.truthy(byText("No progress yet"));
});

// ── TeacherView tests ──────────────────────────────────────────────────────

test.serial("TeacherView shows empty state when no students", async t => {
  const channel = createMockChannel({
    getRoomProgress: () => Promise.resolve({ students: [] })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: true,
      onClose: () => {}
    })
  );

  await waitForText("No student activity yet");
  t.truthy(byText("Close"));
  // Refresh button is NOT rendered in empty state (early return)
  t.falsy(byTextMaybe("Refresh"));
});

test.serial("TeacherView renders student cards with progress", async t => {
  const students = [
    {
      identity_name: "Alice",
      account_id: "acc-1",
      entries: [
        {
          element_slug: "h2o",
          element_type: "element",
          status: "completed",
          score: 100,
          max_score: 100,
          time_spent_ms: 5000
        }
      ]
    },
    {
      identity_name: "Bob",
      session_id: "sess-1",
      entries: [
        {
          element_slug: "nacl",
          element_type: "element",
          status: "started",
          score: null,
          max_score: null,
          time_spent_ms: 3000
        }
      ]
    }
  ];

  const channel = createMockChannel({
    getRoomProgress: () => Promise.resolve({ students })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: true,
      onClose: () => {}
    })
  );

  await waitForText("Room Progress");
  t.truthy(byText("Alice"));
  t.truthy(byText("Bob"));
  t.truthy(byText("1/1"));
  t.truthy(byText("100%"));
  t.truthy(byText("Refresh"));
  t.truthy(byText("Close"));
});

test.serial("TeacherView expand/collapse student details", async t => {
  const students = [
    {
      identity_name: "Alice",
      account_id: "acc-1",
      entries: [
        {
          element_slug: "h2o",
          element_type: "element",
          status: "completed",
          score: 100,
          max_score: 100,
          time_spent_ms: 5000
        }
      ]
    }
  ];

  const channel = createMockChannel({
    getRoomProgress: () => Promise.resolve({ students })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: true,
      onClose: () => {}
    })
  );

  await waitForText("Details");
  t.falsy(byTextMaybe("h2o"));

  await act(() => byText("Details").click());
  await waitForText("h2o");
  t.truthy(byText("Collapse"));
});

test.serial("TeacherView Refresh button reloads data", async t => {
  let callCount = 0;
  const channel = createMockChannel({
    getRoomProgress: () => {
      callCount++;
      return Promise.resolve({
        students: [
          {
            identity_name: "Test",
            account_id: "a1",
            entries: [{ element_slug: "x", element_type: "element", status: "completed" }]
          }
        ]
      });
    }
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: true,
      onClose: () => {}
    })
  );

  await waitForText("Refresh");
  t.is(callCount, 1, "initial load on mount");

  await act(() => byText("Refresh").click());
  await flush();
  t.is(callCount, 2, "refresh increments call count");
});

test.serial("TeacherView renders student with no entries", async t => {
  const students = [{ identity_name: "Charlie", account_id: "acc-3", entries: [] }];

  const channel = createMockChannel({
    getRoomProgress: () => Promise.resolve({ students })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: true,
      onClose: () => {}
    })
  );

  await waitForText(/Charlie.*0\/0.*0%/);
  t.falsy(byTextMaybe("Details"));
});

test.serial("TeacherView re-fetches on progress update event", async t => {
  let registeredHandler = null;
  let loadCallCount = 0;

  const channel = createMockChannel({
    getRoomProgress: () => {
      loadCallCount++;
      return Promise.resolve({
        students: [
          {
            identity_name: "Test",
            account_id: "a1",
            entries: [{ element_slug: "x", element_type: "element", status: "completed" }]
          }
        ]
      });
    },
    onProgressUpdated: handler => {
      registeredHandler = handler;
    }
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: true,
      onClose: () => {}
    })
  );

  await waitForText("Refresh");
  const initialCalls = loadCallCount;
  t.truthy(registeredHandler);

  await act(() => registeredHandler());
  await flush();
  t.is(loadCallCount, initialCalls + 1);
});

// ── Shared ─────────────────────────────────────────────────────────────────

test.serial("onClose fires when Close button clicked", async t => {
  let closed = false;
  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries: [] })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {
        closed = true;
      }
    })
  );

  await waitForText("Close");
  await act(() => byText("Close").click());
  t.truthy(closed);
});

// ── Accessibility ───────────────────────────────────────────────────────────

test.serial("renders buttons as accessible button elements", async t => {
  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries: [] })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("Close");
  const buttons = screen.getAllByRole("button");
  t.truthy(buttons.length >= 1, "at least one button rendered");
});

test.serial("Close button has accessible text content", async t => {
  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries: [] })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("Close");
  const closeBtn = screen.getByRole("button", { name: /close/i });
  t.truthy(closeBtn);
});

test.serial("TeacherView Refresh button is accessible", async t => {
  const channel = createMockChannel({
    getRoomProgress: () =>
      Promise.resolve({
        students: [
          {
            identity_name: "Alice",
            account_id: "a1",
            entries: [{ element_slug: "x", element_type: "element", status: "completed" }]
          }
        ]
      })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: true,
      onClose: () => {}
    })
  );

  await waitForText("Refresh");
  const refreshBtn = screen.getByRole("button", { name: /refresh/i });
  t.truthy(refreshBtn);
});

test.serial("student names are visible text content", async t => {
  const entries = [
    {
      element_slug: "nacl",
      element_type: "element",
      status: "completed",
      score: 100,
      max_score: 100,
      time_spent_ms: 5000
    }
  ];

  const channel = createMockChannel({
    getMyProgress: () => Promise.resolve({ entries })
  });

  renderWithProviders(
    React.createElement(ProgressPanel, {
      channel,
      isTeacher: false,
      onClose: () => {}
    })
  );

  await waitForText("nacl");
  const elementName = screen.getByText("nacl", { exact: true });
  t.truthy(elementName);
  // Element name is a span — should be in the accessibility tree
  t.is(elementName.tagName, "SPAN");
});
