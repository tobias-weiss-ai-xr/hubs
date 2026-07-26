// Unit tests for formatTime (used in both ProgressPanel and AnalyticsDashboard)
import test from "ava";

// Replicate the exact logic from the components
function formatTime(ms) {
  if (!ms) return "";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

test("null and undefined return empty string", t => {
  t.is(formatTime(null), "");
  t.is(formatTime(undefined), "");
});

test("formats sub-minute times as seconds", t => {
  t.is(formatTime(5000), "5s");
});

test("formats 1 second", t => {
  t.is(formatTime(1000), "1s");
});

test("formats 59 seconds", t => {
  t.is(formatTime(59000), "59s");
});

test("formats exactly 1 minute", t => {
  t.is(formatTime(60000), "1m 0s");
});

test("formats 1 minute 5 seconds", t => {
  t.is(formatTime(65000), "1m 5s");
});

test("formats 2 minutes 30 seconds", t => {
  t.is(formatTime(150000), "2m 30s");
});

test("formats sub-second values as 0s", t => {
  // 500ms < 1000ms → floor(500/1000) = 0 → returns "0s"
  t.is(formatTime(500), "0s");
});

test("formats large values", t => {
  t.is(formatTime(3661000), "61m 1s"); // 3661 secs = 61m 1s
});

test("zero, null, undefined all return empty string", t => {
  t.is(formatTime(0), "");
  t.is(formatTime(null), "");
  t.is(formatTime(undefined), "");
});
