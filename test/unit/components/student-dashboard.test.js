import test from "ava";
import React from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { IntlProvider } from "react-intl";

import StudentDashboard from "../../../src/react-components/room/StudentDashboard";

test.serial.afterEach(cleanup);

function renderWithIntl(ui) {
  return render(<IntlProvider locale="de">{ui}</IntlProvider>);
}

function makeMockChannel(entries = [], shouldReject = false) {
  const getMyProgress = () =>
    shouldReject ? Promise.reject(new Error("Not authorized")) : Promise.resolve({ entries });

  const onProgressUpdated = () => {
    // Return a detach function
    return () => {};
  };

  let getMyProgressCallCount = 0;
  const trackedGetMyProgress = () => {
    getMyProgressCallCount++;
    return getMyProgress();
  };

  return {
    getMyProgress: trackedGetMyProgress,
    getMyProgressCallCount: () => getMyProgressCallCount,
    onProgressUpdated
  };
}

test.serial("shows loading state on mount", t => {
  const channel = makeMockChannel();
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  // Loading should be visible initially
  const text = container.textContent;
  t.truthy(text.includes("Loading") || text.includes("progress"));
});

test.serial("renders dashboard title after loading", async t => {
  const channel = makeMockChannel([]);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  t.truthy(container.textContent.includes("Learning") || container.textContent.includes("Progress"));
});

test.serial("shows empty state when no entries", async t => {
  const channel = makeMockChannel([]);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  const text = container.textContent.toLowerCase();
  t.truthy(text.includes("no progress") || text.includes("no progress"));
});

test.serial("renders summary cards with progress data", async t => {
  const entries = [
    { element_slug: "H", status: "completed", score: 10, max_score: 10, time_spent_ms: 5000 },
    { element_slug: "O", status: "completed", score: 8, max_score: 10, time_spent_ms: 3000 },
    { element_slug: "Fe", status: "started", score: null, max_score: null, time_spent_ms: 1000 },
    { element_slug: "Cu", status: "visited", score: null, max_score: null, time_spent_ms: 0 }
  ];
  const channel = makeMockChannel(entries);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  const text = container.textContent;
  // 2 completed out of 4 = 50%
  t.truthy(text.includes("Completed") || text.includes("completed"));
  t.truthy(text.includes("Elements") || text.includes("elements"));
  t.truthy(text.includes("Progress") || text.includes("progress"));
});

test.serial("renders progress bar with aria-valuenow", async t => {
  const entries = [
    { element_slug: "H", status: "completed", score: 10, max_score: 10, time_spent_ms: 1000 },
    { element_slug: "He", status: "completed", score: 9, max_score: 10, time_spent_ms: 2000 },
    { element_slug: "Li", status: "visited", score: null, max_score: null, time_spent_ms: 500 },
    { element_slug: "Be", status: "started", score: null, max_score: null, time_spent_ms: 0 }
  ];
  const channel = makeMockChannel(entries);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  const progressBar = container.querySelector('[role="progressbar"]');
  t.truthy(progressBar);

  // 2 completed out of 4 = 50%
  const valueNow = progressBar.getAttribute("aria-valuenow");
  t.is(valueNow, "50");
});

test.serial("renders element list with status badges", async t => {
  const entries = [
    { element_slug: "H", status: "completed", score: 10, max_score: 10, time_spent_ms: 5000 },
    { element_slug: "Fe", status: "started", score: null, max_score: null, time_spent_ms: 2000 },
    { element_slug: "Cu", status: "visited", score: null, max_score: null, time_spent_ms: 0 }
  ];
  const channel = makeMockChannel(entries);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  const text = container.textContent;
  t.truthy(text.includes("H"));
  t.truthy(text.includes("Fe"));
  t.truthy(text.includes("Cu"));
  t.truthy(text.includes("completed"));
  t.truthy(text.includes("started"));
  t.truthy(text.includes("visited"));
});

test.serial("shows error message when getMyProgress fails", async t => {
  const channel = makeMockChannel([], true);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  t.truthy(container.textContent.includes("Not authorized"));
});

test.serial("renders score for entries that have scores", async t => {
  const entries = [{ element_slug: "H", status: "completed", score: 10, max_score: 10, time_spent_ms: 1000 }];
  const channel = makeMockChannel(entries);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  t.truthy(container.textContent.includes("10"));
});

test.serial("renders time for entries with time_spent_ms > 0", async t => {
  const entries = [{ element_slug: "H", status: "completed", score: 10, max_score: 10, time_spent_ms: 60000 }];
  const channel = makeMockChannel(entries);
  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  t.truthy(container.textContent.includes("60"));
});

test.serial("calls getMyProgress on mount", t => {
  let called = false;
  const channel = makeMockChannel();
  const origGet = channel.getMyProgress;
  channel.getMyProgress = () => {
    called = true;
    return origGet();
  };

  renderWithIntl(<StudentDashboard channel={channel} />);
  t.true(called);
});

test.serial("refresh button triggers reload", async t => {
  let callCount = 0;
  const entries = [{ element_slug: "H", status: "completed", score: 10, max_score: 10, time_spent_ms: 1000 }];

  const channel = {
    getMyProgress: () => {
      callCount++;
      return Promise.resolve({ entries });
    },
    onProgressUpdated: () => () => {}
  };

  const { container } = renderWithIntl(<StudentDashboard channel={channel} />);

  await new Promise(r => setTimeout(r, 50));

  const refreshBtn = container.querySelector("button");
  t.truthy(refreshBtn);
  t.truthy(refreshBtn.textContent.includes("Refresh"));
  fireEvent.click(refreshBtn);

  await new Promise(r => setTimeout(r, 50));

  t.is(callCount, 2);
});
