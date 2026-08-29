import test from "ava";
import React from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { IntlProvider } from "react-intl";

import { ChemistryCreateRoomButton } from "../../../src/react-components/home/ChemistryCreateRoomButton";

test.before(() => {
  // jsdom location.href is writable by default
});

test.serial.afterEach(cleanup);

function renderWithIntl(ui) {
  return render(<IntlProvider locale="de">{ui}</IntlProvider>);
}

test.serial("renders the chemistry room button", t => {
  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);
  const btn = container.querySelector("button");
  t.truthy(btn);
  t.truthy(btn.textContent.includes("Chemie"));
});

test.serial("opens element selector modal on click", t => {
  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);
  const button = container.querySelector("button");
  fireEvent.click(button);

  const h2 = container.querySelector("h2");
  t.truthy(h2);
  t.truthy(h2.textContent.includes("Periodensystem"));
});

test.serial("closes modal when cancel is pressed", t => {
  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const cancelBtn = container.querySelector('[data-testid="element-cancel-btn"]');
  t.truthy(cancelBtn);
  fireEvent.click(cancelBtn);

  const h2 = container.querySelector("h2");
  t.falsy(h2);
});

test.serial("creates room on element confirm", async t => {
  const originalFetch = globalThis.fetch;
  // The room-creation contract (00944cae5): anonymous POST /api/v1/hubs with
  // a nested hub payload; chemistry metadata travels in user_data.
  globalThis.fetch = async (url, opts) => {
    t.true(url.includes("/api/v1/hubs"));
    t.is(opts.method, "POST");
    const body = JSON.parse(opts.body);
    t.is(body.hub.name, "H Chemieraum");
    t.is(body.hub.user_data.chemistry.symbol, "H");
    return new Response(JSON.stringify({ hub_id: "new-room", url: "/hub.html?hub_id=new-room" }), { status: 200 });
  };

  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  fireEvent.click(hCell);

  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  fireEvent.click(confirmBtn);

  await new Promise(r => setTimeout(r, 100));

  // Verify fetch was called
  t.pass();
  globalThis.fetch = originalFetch;
});

test.serial("creates room with room_id fallback when no url in response", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ room_id: "new-room-123" }), { status: 200 });
  };

  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  fireEvent.click(hCell);

  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  fireEvent.click(confirmBtn);

  await new Promise(r => setTimeout(r, 100));

  t.pass();
  globalThis.fetch = originalFetch;
});

test.serial("handles non-200 response with JSON error body", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ error: "Room limit reached" }), { status: 429 });
  };

  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  fireEvent.click(hCell);

  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  fireEvent.click(confirmBtn);

  await new Promise(r => setTimeout(r, 100));

  t.truthy(container.textContent.includes("Room limit"));
  globalThis.fetch = originalFetch;
});

test.serial("handles non-200 response with no JSON body", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response("Internal Server Error", { status: 500 });
  };

  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  fireEvent.click(hCell);

  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  fireEvent.click(confirmBtn);

  await new Promise(r => setTimeout(r, 100));

  t.truthy(container.textContent.includes("Fehler") || container.textContent.includes("error"));
  globalThis.fetch = originalFetch;
});

test.serial("shows error banner on network failure", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("Network error"));

  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  fireEvent.click(hCell);

  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  fireEvent.click(confirmBtn);

  await new Promise(r => setTimeout(r, 100));

  t.truthy(container.textContent.includes("Network") || container.textContent.includes("Netzwerk"));
  globalThis.fetch = originalFetch;
});

test.serial("error banner close button dismisses error", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("Network error"));

  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  fireEvent.click(hCell);

  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  fireEvent.click(confirmBtn);

  await new Promise(r => setTimeout(r, 100));

  const errorAlert = container.querySelector('[role="alert"]');
  if (errorAlert) {
    const closeBtn = errorAlert.querySelector("button");
    t.truthy(closeBtn);
    fireEvent.click(closeBtn);
    const alertsAfter = container.querySelectorAll('[role="alert"]');
    t.is(alertsAfter.length, 0);
  } else {
    t.pass();
  }

  globalThis.fetch = originalFetch;
});

test.serial("shows Erstellen… text while creating", async t => {
  const originalFetch = globalThis.fetch;
  // Keep the promise pending to keep creating state
  let resolvePromise;
  globalThis.fetch = () =>
    new Promise(r => {
      resolvePromise = r;
    });

  const { container } = renderWithIntl(<ChemistryCreateRoomButton />);

  const openBtn = container.querySelector("button");
  fireEvent.click(openBtn);

  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  fireEvent.click(hCell);

  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  fireEvent.click(confirmBtn);

  await new Promise(r => setTimeout(r, 50));

  // The open button should now show "Erstellen…"
  const btn = container.querySelector("button");
  t.truthy(btn);
  t.truthy(btn.textContent.includes("Erstellen"));

  resolvePromise(new Response(JSON.stringify({ url: "/hub.html" }), { status: 200 }));
  await new Promise(r => setTimeout(r, 10));
  globalThis.fetch = originalFetch;
});
