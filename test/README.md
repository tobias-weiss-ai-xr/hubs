# Test Infrastructure

## Test Runner

We use [ava](https://avajs.dev/) v4.x for unit tests. Tests are run through
`@babel/register` + `esm` to handle the project's JavaScript transpilation needs.

## Running Tests

```bash
npm test                  # lint + unit tests
npm run test:unit         # unit tests only
npm run test:coverage     # unit tests with c8 code coverage report
npm run test:e2e          # Playwright E2E tests
```

## Test Structure

```
test/unit/
├── hub-channel-progress.test.js      # Phoenix channel protocol tests
├── use-progress-tracker.test.js       # Progress tracking algorithm tests
└── utils/
    └── component-mappings.test.js     # Component mapping tests
```

## What We Test

### hub-channel-progress.test.js (32 tests)

Tests the **Phoenix channel protocol** — the event names, payload shapes, and
async push/receive flow used by the real `HubChannel` class. A **contract test**
reads the real `src/utils/hub-channel.js` source at test time and verifies the
mock signatures match the real implementation.

**Coverage:**
- `trackProgress` — 9 tests (basic, spread, minimal, error, null, empty,
  override, concurrent, large payload)
- `getMyProgress` — 5 tests (basic, entries, empty, error, race condition)
- `getRoomProgress` — 4 tests (basic, students, empty, forbidden)
- `fetchAnalytics` — 4 tests (URL, schema, network error, JSON parse error)
- `onProgressUpdated` — 5 tests (register, multiple calls, multiple handlers,
  missing channel, detach lifecycle)
- Contract test — 1 test
- Integration — 2 tests (track→broadcast, server schema)
- Handler cleanup — 2 tests (single detach, multiple detach)

### use-progress-tracker.test.js (20 tests)

Tests the **tracking algorithm** independently of React. The test creates a
`createTracker()` function that replicates the core logic of the
`useProgressTracker` hook (activate/deactivate/track lifecycle).

**Coverage:**
- `track` — 2 tests (arguments, null channel/slug)
- `activate` — 6 tests (started, null slug, idempotent, transition, rapid,
  same-slug-different-type, empty string)
- `deactivate` — 5 tests (basic, no-op, early, repeated)
- Lifecycle — 2 tests (start→navigate→end, track independence)
- Error handling — 2 tests (swallowing)
- Channel missing — 2 tests (activate, deactivate)

### component-mappings.test.js (1 test)

Existing test for the `getSanitizedComponentMapping` utility.

## Coverage

```bash
npm run test:coverage    # generates text + lcov reports
```

Coverage is measured by [c8](https://github.com/bcoe/c8) (V8's built-in
coverage). Because we test through mock objects rather than loading the real
React components (which require webpack), coverage for `src/` is limited to
files that are directly loaded during tests.

## Limitations

- **No React component tests** — The project uses CSS Modules and webpack-specific
  imports (images, SCSS) that can't be resolved by Node.js without a full
  webpack build. See `e2e/` for integration-level coverage.
- **No HubChannel class import** — The real `HubChannel` depends on the `phoenix`
  npm package (ESM) and webpack assets. We test the protocol contract instead.
- **Backend tests** — Elixir/ExUnit tests live in `services/reticulum/test/` and
  require `mix test` to run inside the Docker container.

## Playwright E2E Tests

```bash
npm run test:e2e                 # chromium only (configured in playwright.config.js)
npm run test:e2e:install         # install chromium + system deps
TEST_ROOM_URL=<url> npm run test:e2e   # includes room tests (skipped by default)
TEST_HUB_ID=<id> npm run test:e2e      # includes API tests (skipped by default)
```
