/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContrastFixture } from "./contrast.fixture.ts";

describe("ContrastFixture", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.body.appendChild(document.createElement("div"));
  });

  afterEach(() => {
    host.remove();
  });

  function query(selector: string): Element {
    const found = host.querySelector(selector);
    if (found === null)
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  it("reads the computed forms of a color, a mixed one's included", () => {
    expect([
      ContrastFixture.parse("rgb(10, 20, 30)"),
      ContrastFixture.parse("rgba(10, 20, 30, 0.25)"),
      ContrastFixture.parse("color(srgb 1 0 0.5 / 0.5)"),
      ContrastFixture.parse("color(srgb 0 1 0)"),
      ContrastFixture.parse("transparent")
    ]).toEqual([[10, 20, 30, 1], [10, 20, 30, 0.25], [255, 0, 127.5, 0.5], [0, 255, 0, 1], [0, 0, 0, 0]]);
  });

  it("refuses a color form it doesn't read, rather than taking its numbers as sRGB", () => {
    for (const color of ["color(display-p3 1 0 0)", "oklch(0.6 0.1 200)", "lab(50 20 30)", "currentcolor", ""])
      expect(() => ContrastFixture.parse(color)).toThrow(`The color ${color} isn't in a form the fixture reads.`);
  });

  it("composites a translucent color over another, and gives nothing for two transparent ones", () => {
    expect([ContrastFixture.over([0, 0, 0, 0.5], [255, 255, 255, 1]), ContrastFixture.over([0, 0, 0, 0], [0, 0, 0, 0])]).toEqual([[127.5, 127.5, 127.5, 1], [0, 0, 0, 0]]);
  });

  it("gives WCAG's ratios: 21 for black on white, 1 for a color on itself", () => {
    expect(ContrastFixture.ratio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 6);
    expect(ContrastFixture.ratio([119, 119, 119, 1], [119, 119, 119, 1])).toBe(1);
  });

  it("measures text, an edge and two fills over the backgrounds under them, translucent ones composited", () => {
    host.innerHTML = `<div style="background: rgb(0, 0, 0)"><div class="half" style="background: rgba(255, 255, 255, 0.5)">`
      + `<span style="color: rgb(255, 255, 255)">Text</span><span class="edged" style="outline: 1px solid rgb(0, 0, 255)">Edge</span></div></div>`
      + `<div class="white" style="background: rgb(255, 255, 255)"></div>`;
    const gray = ContrastFixture.ratio([255, 255, 255, 1], [127.5, 127.5, 127.5, 1]);

    expect([
      ContrastFixture.backgroundOf(query(".half")),
      ContrastFixture.ofText(query("span")),
      ContrastFixture.ofEdge(query(".edged"), "outline-color"),
      ContrastFixture.ofFills(query(".white"), query(".half")),
      ContrastFixture.ofEdge(document.documentElement, "color")
    ]).toEqual([[127.5, 127.5, 127.5, 1], gray, ContrastFixture.ratio([0, 0, 255, 1], [127.5, 127.5, 127.5, 1]), gray,
      ContrastFixture.ratio(ContrastFixture.parse(getComputedStyle(document.documentElement).color), [255, 255, 255, 1])]);
  });

  it("refuses a property the browser doesn't know, rather than reading it as black", () => {
    host.innerHTML = `<span style="outline: 1px solid rgb(0, 0, 255)">Edge</span>`;

    expect(() => ContrastFixture.ofText(query("span"), "outline-top-color")).toThrow("The element has no outline-top-color.");
    expect(() => ContrastFixture.ofEdge(query("span"), "outline-top-color")).toThrow("The element has no outline-top-color.");
  });

  it("measures a ring drawn inside the edge over the element's own fill, and one drawn outside over what is under the element", () => {
    host.innerHTML = `<div style="background: rgb(0, 0, 0)"><span class="inset" style="background: rgb(255, 255, 255); outline: 1px solid rgb(0, 0, 255); outline-offset: -1px">In</span>`
      + `<span class="outset" style="background: rgb(255, 255, 255); outline: 1px solid rgb(0, 0, 255); outline-offset: 2px">Out</span></div>`;

    expect([ContrastFixture.ofOutline(query(".inset")), ContrastFixture.ofOutline(query(".outset"))])
      .toEqual([ContrastFixture.ratio([0, 0, 255, 1], [255, 255, 255, 1]), ContrastFixture.ratio([0, 0, 255, 1], [0, 0, 0, 1])]);
  });
});
