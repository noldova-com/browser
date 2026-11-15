/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserEvents } from "../../src/models/browser-events.ts";

describe("BrowserEvents", () => {
  it("names the page activity event under the module's id, as Noldova Desktop routes a part's events", () => {
    expect(BrowserEvents.pageActivity).toBe("browser.pageActivity");
  });
});
