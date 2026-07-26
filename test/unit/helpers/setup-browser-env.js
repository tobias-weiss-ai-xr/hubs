/**
 * Browser environment setup for ava + @testing-library/react.
 *
 * Provides:
 * - jsdom globals (document, window, navigator, etc.)
 * - CSS Modules mock (.scss / .css files return identity proxy)
 * - requestAnimationFrame polyfill
 */
const { JSDOM } = require("jsdom");
const Module = require("module");

// ── 1. jsdom environment ──────────────────────────────────────────────────
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLAnchorElement = dom.window.HTMLAnchorElement;
global.customElements = dom.window.customElements;

// Copy window properties that React / testing-library need
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (!(key in global)) {
    try {
      global[key] = dom.window[key];
    } catch {
      // Some properties are read-only or throw on assignment
    }
  }
}

// requestAnimationFrame polyfill
if (typeof global.requestAnimationFrame !== "function") {
  global.requestAnimationFrame = cb => setTimeout(cb, 0);
  global.cancelAnimationFrame = id => clearTimeout(id);
}

// ── 2. CSS Modules mock ──────────────────────────────────────────────────
// Intercept .scss and .css file imports, return a Proxy that maps any key
// to itself (identity pattern, like identity-obj-proxy).
const cssExtensions = [".scss", ".css", ".module.scss", ".module.css"];

for (const ext of cssExtensions) {
  Module._extensions[ext] = function (mod) {
    const proxy = new Proxy(
      {},
      {
        get(_target, key) {
          if (key === "__esModule") return true;
          if (key === "default") return proxy;
          if (typeof key === "string") return key;
          return key;
        }
      }
    );
    mod.exports = proxy;
  };
}

// ── 3. (optional) react-intl stub ──────────────────────────────────────────
// We don't mock react-intl here — tests should wrap in IntlProvider.
// If a component uses FormattedMessage without IntlProvider, it will
// throw a helpful error from react-intl itself.
