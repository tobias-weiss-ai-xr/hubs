import test from "ava";
import React from "react";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import AnalyticsDashboard from "../../../src/react-components/room/AnalyticsDashboard";

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
    fetchAnalytics: () => Promise.resolve(null),
    onProgressUpdated: () => {}
  };
  return { ...defaults, ...overrides };
}

async function flush() {
  await act(() => Promise.resolve());
}

/**
 * Wait for a text node to appear. Uses { exact: false } so that
 * text split across React text nodes (common with template literals
 * like `{0}/{0}`) still matches.
 */
async function waitForText(text, timeout = 2000) {
  return waitFor(() => screen.getByText(text, { exact: false }), { timeout });
}

/** Shortcut for screen.getByText with { exact: false }. */
function byText(text) {
  return screen.getByText(text, { exact: false });
}

function byTextMaybe(text) {
  return screen.queryByText(text, { exact: false });
}

// ── Loading state ──────────────────────────────────────────────────────────

test.serial("shows loading indicator while fetching", t => {
  const channel = createMockChannel({
    fetchAnalytics: () => new Promise(() => {}) // never resolves
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  t.truthy(byText("Loading…"));
  // Close button is not rendered in loading state
  t.falsy(byTextMaybe("Close"));
});

// ── Room stats ─────────────────────────────────────────────────────────────

test.serial("renders room stats card", async t => {
  const data = {
    room: {
      name: "Chemistry Lab 101",
      current_occupants: 5,
      members_in_room: 3,
      members_in_lobby: 2,
      max_ccu_24h: 12
    },
    students: [],
    quiz_summary: null
  };

  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Chemistry Lab 101");
  t.truthy(byText("5"));
  t.truthy(byText("3"));
  t.truthy(byText("12"));
  t.truthy(byText("Present"));
  t.truthy(byText("Peak (24h)"));
});

test.serial("handles null room gracefully", async t => {
  const data = { room: null, students: [], quiz_summary: null };
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("No student activity yet");
  t.truthy(byText("No quizzes yet"));
});

// ── Student progress list ──────────────────────────────────────────────────

test.serial("renders student progress list", async t => {
  const data = {
    room: null,
    students: [
      { identity_name: "Alice", completed: 3, total_elements: 5, total_time_spent_ms: 10000, quiz_avg_score: 85 },
      { identity_name: "Bob", completed: 1, total_elements: 1, total_time_spent_ms: 2000, quiz_avg_score: null }
    ],
    quiz_summary: null
  };

  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Students (2)");
  t.truthy(byText("Alice"));
  t.truthy(byText("Bob"));
  t.truthy(byText("3/5"));
  t.truthy(byText("1/1"));
  t.truthy(byText("10s"));
  t.truthy(byText("2s"));
  t.truthy(byText("Q: 85%"));
});

test.serial("formats large time values correctly", async t => {
  const data = {
    room: null,
    students: [
      {
        identity_name: "LongTime",
        completed: 5,
        total_elements: 10,
        total_time_spent_ms: 3723000,
        quiz_avg_score: null
      }
    ],
    quiz_summary: null
  };

  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("LongTime");
  // 3723000ms = 3723s = 62m 3s
  t.truthy(byText("62m 3s"));
});

test.serial("shows empty state when no students", async t => {
  const data = { room: null, students: [], quiz_summary: null };
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("No student activity yet");
  t.pass();
});

// ── Quiz summary ───────────────────────────────────────────────────────────

test.serial("renders quiz summary with data", async t => {
  const data = {
    room: null,
    students: [],
    quiz_summary: { total_quizzes: 3, total_participants: 5, average_score: 72.5 }
  };

  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("3");
  // Use exact matching for "5" to avoid matching "72.5%" (also contains '5')
  t.truthy(screen.getByText("5", { exact: true }));
  t.truthy(byText("72.5%"));
  t.truthy(byText("Total"));
  t.truthy(byText("Participants"));
  t.truthy(byText("Avg Score"));
});

test.serial("renders no quizzes placeholder when total_quizzes is 0", async t => {
  const data = {
    room: null,
    students: [],
    quiz_summary: { total_quizzes: 0, total_participants: 0, average_score: null }
  };

  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("No quizzes yet");
  t.pass();
});

test.serial("renders no quizzes placeholder when quiz_summary is null", async t => {
  const data = { room: null, students: [], quiz_summary: null };
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("No quizzes yet");
  t.pass();
});

// ── Edge cases ─────────────────────────────────────────────────────────────

test.serial("handles fetchAnalytics error", async t => {
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.reject(new Error("API unavailable"))
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Failed to load analytics");
  t.truthy(byText("Refresh"));
  t.truthy(byText("Close"));
});

test.serial("Refresh button re-fetches data", async t => {
  let callCount = 0;
  const channel = createMockChannel({
    fetchAnalytics: () => {
      callCount++;
      return Promise.resolve({ room: null, students: [], quiz_summary: null });
    }
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Refresh");
  t.is(callCount, 1, "initial fetch on mount");

  await act(() => byText("Refresh").click());
  await flush();
  t.is(callCount, 2, "refresh triggers re-fetch");
});

test.serial("error state can be recovered via Refresh", async t => {
  // First call fails, second call succeeds
  let callCount = 0;
  const channel = createMockChannel({
    fetchAnalytics: () => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("API down"));
      return Promise.resolve({
        room: { name: "Recovered Room", current_occupants: 3 },
        students: [{ identity_name: "Alice", completed: 2, total_elements: 2 }],
        quiz_summary: null
      });
    }
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  // First render: error state
  await waitForText("Failed to load analytics");
  t.truthy(byText("Refresh"));

  // Click Refresh → second call succeeds
  await act(() => byText("Refresh").click());
  await flush();

  // Should now show recovered data
  t.truthy(byText("Recovered Room"));
  t.truthy(byText("Alice"));
});

test.serial("re-fetches on progress update event", async t => {
  let registeredHandler = null;
  let loadCallCount = 0;

  const channel = createMockChannel({
    fetchAnalytics: () => {
      loadCallCount++;
      return Promise.resolve({ room: null, students: [], quiz_summary: null });
    },
    onProgressUpdated: handler => {
      registeredHandler = handler;
    }
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
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

test.serial("onClose fires when Close button clicked", async t => {
  let closed = false;
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve({ room: null, students: [], quiz_summary: null })
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {
        closed = true;
      }
    })
  );

  await waitForText("Close");
  await act(() => byText("Close").click());
  t.truthy(closed);
});

test.serial("does not crash with minimal data (missing optional fields)", async t => {
  const data = {
    room: { name: "Test" },
    students: [{ identity_name: "Test", account_id: "acc-1" }],
    quiz_summary: { total_quizzes: 1 }
  };

  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  // Wait for any "Test" element to appear (there are two: room name + student name)
  await waitFor(() => {
    const elements = screen.getAllByText("Test", { exact: true });
    if (elements.length === 0) throw new Error("No 'Test' elements found");
  });
  // Use getAllByText to confirm at least one exists
  t.truthy(screen.getAllByText("Test", { exact: true }).length >= 1);
  t.truthy(screen.getByText("1", { exact: true })); // total_quizzes, exact match
  t.truthy(screen.getAllByText("—", { exact: true }).length >= 1); // dashes for missing values
});

// ── Accessibility ───────────────────────────────────────────────────────────

test.serial("renders buttons as accessible button elements", async t => {
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve({ room: null, students: [], quiz_summary: null })
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Refresh");
  const buttons = screen.getAllByRole("button");
  t.truthy(buttons.length >= 2, "at least two buttons (Refresh + Close)");
});

test.serial("Refresh button is accessible by role", async t => {
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve({ room: null, students: [], quiz_summary: null })
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Refresh");
  const refreshBtn = screen.getByRole("button", { name: /refresh/i });
  t.truthy(refreshBtn);
});

test.serial("Close button is accessible by role", async t => {
  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve({ room: null, students: [], quiz_summary: null })
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Close");
  const closeBtn = screen.getByRole("button", { name: /close/i });
  t.truthy(closeBtn);
});

test.serial("room name heading is rendered", async t => {
  const data = {
    room: { name: "Physics Lab", current_occupants: 2 },
    students: [],
    quiz_summary: null
  };

  const channel = createMockChannel({
    fetchAnalytics: () => Promise.resolve(data)
  });

  renderWithProviders(
    React.createElement(AnalyticsDashboard, {
      channel,
      onClose: () => {}
    })
  );

  await waitForText("Physics Lab");
  const heading = screen.getByText("Physics Lab", { exact: true });
  t.truthy(heading);
});
