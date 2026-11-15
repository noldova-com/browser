/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AccessibilityTreeFixture } from "./accessibility-tree.fixture.ts";

describe("AccessibilityTreeFixture", () => {
  let host: HTMLElement;

  function find(selector: string): Element {
    const found: Element | null = host.querySelector(selector);
    if (found === null)
      throw new Error(`The host has no ${selector}.`);
    return found;
  }

  beforeEach(() => {
    host = document.body.appendChild(document.createElement("div"));
  });

  afterEach(() => {
    host.remove();
  });

  it("reads an element's nodes in Chromium's tree, itself first, without generic nodes or text that repeats the name above it, and removes its mark", async () => {
    host.innerHTML = `<nav aria-label="Main"><div><button type="button">Go</button><p>Some text</p>`
      + `<input aria-label="Field" value="typed" aria-invalid="true" aria-describedby="help"><span id="help">Help</span></div></nav>`;

    expect(await AccessibilityTreeFixture.readAsync(find("nav"))).toEqual([
      "navigation \"Main\"",
      "  button \"Go\"",
      "  paragraph",
      "    StaticText \"Some text\"",
      "  textbox \"Field\" description=\"Help\" value=\"typed\" invalid",
      "  StaticText \"Help\""
    ]);
    expect(host.querySelector("[data-accessibility-tree-probe]")).toBeNull();
  });

  it("names the states that hold, a closed popup's expanded=false and a heading's level", async () => {
    host.innerHTML = `<h3>Title</h3><button type="button" aria-expanded="false" aria-haspopup="menu">More</button>`
      + `<button type="button" aria-pressed="true" disabled>Bold</button><div role="tab" aria-selected="true">One</div>`;

    expect(await AccessibilityTreeFixture.readAsync(host)).toEqual([
      "heading \"Title\" level=3",
      "button \"More\" expanded=false hasPopup=menu",
      "button \"Bold\" pressed disabled",
      "tab \"One\" selected"
    ]);
  });

  it("fails for an element outside the page's document, or one the tree leaves out", async () => {
    host.innerHTML = `<div style="display: none"><span>Hidden</span></div>`;

    await expect(AccessibilityTreeFixture.readAsync(document.createElement("div"))).rejects.toThrow("The element isn't in the page's document.");
    await expect(AccessibilityTreeFixture.readAsync(find("span"))).rejects.toThrow("The element has no node in the accessibility tree.");
  });
});
