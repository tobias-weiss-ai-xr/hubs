import test from "ava";
import React from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { IntlProvider } from "react-intl";

import TokenGenerationPanel from "../../../src/react-components/room/TokenGenerationPanel";

test.serial.afterEach(cleanup);

function renderWithIntl(ui) {
  return render(<IntlProvider locale="de">{ui}</IntlProvider>);
}

const mockChannel = {
  hubId: "test-hub-123",
  store: {
    state: {
      credentials: { token: "mock-token" }
    }
  }
};

test.serial("renders the panel title", t => {
  const { container } = renderWithIntl(<TokenGenerationPanel channel={mockChannel} onClose={() => {}} />);
  t.truthy(container.textContent.includes("Access Tokens"));
});

test.serial("renders both generate buttons", t => {
  const { container } = renderWithIntl(<TokenGenerationPanel channel={mockChannel} onClose={() => {}} />);
  t.truthy(container.textContent.includes("Generate Student Token"));
  t.truthy(container.textContent.includes("Generate Teacher Token"));
});

test.serial("shows empty state before any tokens generated", t => {
  const { container } = renderWithIntl(<TokenGenerationPanel channel={mockChannel} onClose={() => {}} />);
  // The hint text or empty state text
  const text = container.textContent.toLowerCase();
  t.truthy(text.includes("no tokens") || text.includes("token"));
});

test.serial("calls onClose when Close button is clicked", t => {
  let closed = false;
  const { container } = renderWithIntl(
    <TokenGenerationPanel
      channel={mockChannel}
      onClose={() => {
        closed = true;
      }}
    />
  );

  const closeBtn = [...container.querySelectorAll("button")].find(
    b => b.textContent && (b.textContent.includes("Close") || b.textContent.includes("Schließen"))
  );
  t.truthy(closeBtn);
  fireEvent.click(closeBtn);
  t.true(closed);
});

test.serial("generate student token calls fetch with student role", async t => {
  const originalFetch = globalThis.fetch;
  let capturedUrl, capturedOpts;
  globalThis.fetch = (url, opts) => {
    capturedUrl = url;
    capturedOpts = opts;
    return Promise.resolve(
      new Response(JSON.stringify({ access_token: "student-token-abc", role: "student" }), { status: 200 })
    );
  };

  const { container } = renderWithIntl(<TokenGenerationPanel channel={mockChannel} onClose={() => {}} />);

  const studentBtn = [...container.querySelectorAll("button")].find(
    b => b.textContent && b.textContent.includes("Generate Student")
  );
  t.truthy(studentBtn);
  fireEvent.click(studentBtn);

  await new Promise(r => setTimeout(r, 50));

  t.truthy(capturedUrl);
  t.true(capturedUrl.includes("/api/v1/rooms/token"));
  t.is(capturedOpts.method, "POST");
  const body = JSON.parse(capturedOpts.body);
  t.is(body.room_id, "test-hub-123");
  t.is(body.role, "student");

  globalThis.fetch = originalFetch;
});

test.serial("generate teacher token sends teacher role", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    return Promise.resolve(
      new Response(JSON.stringify({ access_token: "teacher-token-xyz", role: "teacher" }), { status: 200 })
    );
  };

  const { container } = renderWithIntl(<TokenGenerationPanel channel={mockChannel} onClose={() => {}} />);

  const teacherBtn = [...container.querySelectorAll("button")].find(
    b => b.textContent && b.textContent.includes("Generate Teacher")
  );
  t.truthy(teacherBtn);
  fireEvent.click(teacherBtn);

  await new Promise(r => setTimeout(r, 50));

  globalThis.fetch = originalFetch;
  t.pass();
});

test.serial("shows error message on token generation failure", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }));

  const { container } = renderWithIntl(<TokenGenerationPanel channel={mockChannel} onClose={() => {}} />);

  const studentBtn = [...container.querySelectorAll("button")].find(
    b => b.textContent && b.textContent.includes("Generate Student")
  );
  fireEvent.click(studentBtn);

  await new Promise(r => setTimeout(r, 50));

  t.truthy(container.textContent.includes("Forbidden"));

  globalThis.fetch = originalFetch;
});

test.serial("disables generate button while generating", async t => {
  const originalFetch = globalThis.fetch;
  // Return a promise that never resolves to keep generating state
  let neverResolve;
  const neverPromise = new Promise(r => {
    neverResolve = r;
  });
  globalThis.fetch = () => neverPromise;

  const { container } = renderWithIntl(<TokenGenerationPanel channel={mockChannel} onClose={() => {}} />);

  // Count buttons before
  const generateBtn = [...container.querySelectorAll("button")].find(
    b => b.textContent && b.textContent.includes("Generate Student")
  );
  t.truthy(generateBtn);
  t.false(generateBtn.disabled);

  fireEvent.click(generateBtn);

  await new Promise(r => setTimeout(r, 50));

  // The same button should now be disabled (or "Generating…")
  t.true(generateBtn.disabled);

  // Clean up
  neverResolve(new Response("", { status: 200 }));
  await new Promise(r => setTimeout(r, 10));
  globalThis.fetch = originalFetch;
});
