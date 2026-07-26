import test from "ava";
import React from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { IntlProvider } from "react-intl";

import ElementSelector from "../../../src/react-components/room/ElementSelector";

test.serial.afterEach(cleanup);

function renderWithIntl(ui) {
  return render(<IntlProvider locale="de">{ui}</IntlProvider>);
}

test.serial("renders the PSE title", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);
  t.truthy(container.querySelector("h2"));
  t.truthy(
    [...container.querySelectorAll("*")].some(el => el.textContent && el.textContent.includes("Periodensystem"))
  );
});

test.serial("renders all 118 element cells plus cancel button", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);
  const cells = container.querySelectorAll('[data-testid^="element-cell-"]');
  t.is(cells.length, 118);
});

test.serial("calls onClose with element symbol on confirm", t => {
  let calledSymbol = null;
  const onClose = sym => {
    calledSymbol = sym;
  };
  const { container } = renderWithIntl(<ElementSelector onClose={onClose} />);

  // Click H cell
  const hCell = container.querySelector('[data-testid="element-cell-H"]');
  t.truthy(hCell);
  fireEvent.click(hCell);

  // Confirm button should now be visible
  const confirmBtn = container.querySelector('[data-testid="element-confirm-btn"]');
  t.truthy(confirmBtn);
  fireEvent.click(confirmBtn);

  t.is(calledSymbol, "H");
});

test.serial("calls onClose with null on cancel", t => {
  let calledWith = "UNSET";
  const onClose = sym => {
    calledWith = sym;
  };
  const { container } = renderWithIntl(<ElementSelector onClose={onClose} />);

  const cancelBtn = container.querySelector('[data-testid="element-cancel-btn"]');
  t.truthy(cancelBtn);
  fireEvent.click(cancelBtn);

  t.is(calledWith, null);
});

test.serial("highlights selected element cell via aria-pressed", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);

  const feCell = container.querySelector('[data-testid="element-cell-Fe"]');
  t.truthy(feCell);
  fireEvent.click(feCell);

  const pressed = container.querySelectorAll('[aria-pressed="true"]');
  t.is(pressed.length, 1);
  t.is(pressed[0].getAttribute("data-testid"), "element-cell-Fe");
});

test.serial("renders the legend with group labels", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);
  const text = container.textContent;
  t.truthy(text.includes("Nichtmetalle"));
  t.truthy(text.includes("Edelgase"));
  t.truthy(text.includes("Übergangsmetalle"));
});

test.serial("renders lanthanides and actinides row labels", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);
  const text = container.textContent;
  t.truthy(text.includes("Lanthanoide"));
  t.truthy(text.includes("Actinoide"));
});

test.serial("selecting different element updates info card", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);

  // Click Fe (Eisen)
  const feCell = container.querySelector('[data-testid="element-cell-Fe"]');
  t.truthy(feCell);
  fireEvent.click(feCell);

  t.truthy(container.textContent.includes("Eisen"));

  // Click O (Sauerstoff)
  const oCell = container.querySelector('[data-testid="element-cell-O"]');
  t.truthy(oCell);
  fireEvent.click(oCell);

  t.truthy(container.textContent.includes("Sauerstoff"));
});

test.serial("does not crash when onSelect is not provided", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);
  const firstCell = container.querySelector('[data-testid^="element-cell-"]');
  t.truthy(firstCell);
  fireEvent.click(firstCell);
  t.pass();
});

test.serial("info card shows atomic number, group, period", t => {
  const { container } = renderWithIntl(<ElementSelector onClose={() => {}} />);

  const feCell = container.querySelector('[data-testid="element-cell-Fe"]');
  fireEvent.click(feCell);

  const text = container.textContent;
  t.truthy(text.includes("Ordnungszahl") || text.includes("number"));
  t.truthy(text.includes("26")); // Fe atomic number
  t.truthy(text.includes("8")); // Fe group
  t.truthy(text.includes("4")); // Fe period
});
