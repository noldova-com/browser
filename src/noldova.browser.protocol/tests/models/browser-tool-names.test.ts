/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserToolNames } from "../../src/models/browser-tool-names.ts";

describe("BrowserToolNames", () => {
  it("names each tool once, and lists the names in the order the module registers the tools", () => {
    expect([BrowserToolNames.navigate, BrowserToolNames.snapshot, BrowserToolNames.click, BrowserToolNames.type, BrowserToolNames.pressKey,
      BrowserToolNames.screenshot, BrowserToolNames.console, BrowserToolNames.waitFor]).toEqual(BrowserToolNames.all);
  });

  it("lists the eight agent tools in registration order", () => {
    expect(BrowserToolNames.all).toEqual([
      "browser_navigate",
      "browser_snapshot",
      "browser_click",
      "browser_type",
      "browser_press_key",
      "browser_screenshot",
      "browser_console",
      "browser_wait_for"
    ]);
  });

  it("lists each name once", () => {
    expect(new Set(BrowserToolNames.all).size).toBe(BrowserToolNames.all.length);
  });

  it("names every tool in lower case under the browser_ prefix", () => {
    for (const name of BrowserToolNames.all)
      expect(name).toMatch(/^browser_[a-z]+(?:_[a-z]+)*$/);
  });

  it("includes each listed name", () => {
    for (const name of BrowserToolNames.all)
      expect(BrowserToolNames.includes(name)).toBe(true);
  });

  it("refuses a name that differs in case, an unknown name and an empty name", () => {
    expect(BrowserToolNames.includes("Browser_Click")).toBe(false);
    expect(BrowserToolNames.includes("browser_evaluate")).toBe(false);
    expect(BrowserToolNames.includes("")).toBe(false);
  });
});
