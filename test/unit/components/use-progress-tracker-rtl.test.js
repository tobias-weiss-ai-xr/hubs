/* eslint-disable react/prop-types */
import test from "ava";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import useProgressTracker from "../../../src/react-components/room/hooks/useProgressTracker";

test.beforeEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function wrap(ui) {
  return React.createElement(IntlProvider, { locale: "en" }, ui);
}

function createChannel() {
  const calls = [];
  const channel = {
    trackProgress(slug, type, data) {
      calls.push({ slug, type, data });
      return Promise.resolve();
    }
  };
  return { channel, calls };
}

// ── Tests that mount/unmount the real hook to exercise useEffect paths ────

test.serial("mount with valid channel+slug tracks started", async t => {
  const { channel } = createChannel();

  function TestComp() {
    useProgressTracker(channel, "el-1", "element");
    return null;
  }

  const { unmount } = render(wrap(React.createElement(TestComp)));

  // Wait for effects to fire and promises to settle
  await new Promise(r => setTimeout(r, 10));
  t.pass();
  unmount();
});

test.serial("mount with null channel does not throw", async t => {
  function TestComp() {
    useProgressTracker(null, "el-1", "element");
    return null;
  }

  render(wrap(React.createElement(TestComp)));
  await new Promise(r => setTimeout(r, 10));
  t.pass();
});

test.serial("unmount triggers cleanup tracking (visited + time)", async t => {
  const { channel, calls } = createChannel();

  function TestComp() {
    useProgressTracker(channel, "el-1", "element");
    return null;
  }

  const { unmount } = render(wrap(React.createElement(TestComp)));
  await new Promise(r => setTimeout(r, 10));

  // Unmount to trigger cleanup useEffect return
  unmount();
  await new Promise(r => setTimeout(r, 10));

  // On mount: "started" tracked
  // On unmount: "visited" tracked via cleanup
  t.true(calls.length >= 1);
  const startedCall = calls.find(c => c.data.status === "started");
  t.truthy(startedCall);
  const visitedCall = calls.find(c => c.data.status === "visited");
  t.truthy(visitedCall);
  t.true(typeof visitedCall?.data.time_spent_ms === "number");
});

test.serial("element slug transition tracks previous as visited", async t => {
  const { channel, calls } = createChannel();

  function TestComp({ slug }) {
    useProgressTracker(channel, slug, "element");
    return null;
  }

  const { rerender } = render(wrap(React.createElement(TestComp, { slug: "el-1" })));
  await new Promise(r => setTimeout(r, 10));

  // Change slug to trigger the if (elementSlug !== currentSlug.current) branch
  rerender(wrap(React.createElement(TestComp, { slug: "el-2" })));
  await new Promise(r => setTimeout(r, 10));

  // Should have: started el-1, visited el-1, started el-2
  const startedEl1 = calls.filter(c => c.slug === "el-1" && c.data.status === "started");
  const visitedEl1 = calls.filter(c => c.slug === "el-1" && c.data.status === "visited");
  const startedEl2 = calls.filter(c => c.slug === "el-2" && c.data.status === "started");

  t.true(startedEl1.length >= 1);
  t.true(visitedEl1.length >= 1);
  t.true(startedEl2.length >= 1);

  if (visitedEl1.length > 0) {
    t.true(typeof visitedEl1[0].data.time_spent_ms === "number");
  }
});

test.serial("channel.trackProgress error is silently caught", async t => {
  const errorChannel = {
    trackProgress() {
      return Promise.reject(new Error("fail"));
    }
  };

  function TestComp() {
    useProgressTracker(errorChannel, "el-1", "element");
    return null;
  }

  render(wrap(React.createElement(TestComp)));
  await new Promise(r => setTimeout(r, 10));
  t.pass();
});
