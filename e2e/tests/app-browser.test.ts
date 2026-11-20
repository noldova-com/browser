/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { AppBrowser } from "../fixtures/app-browser.ts";

describe("AppBrowser", () => {
  it("reads the test app's product name", () => {
    expect(AppBrowser.productName).toBe("Browser Test");
  });

  it("matches the text with the test app's browser before it, and no other app's, nor this browser", () => {
    const saying = AppBrowser.saying("doesn't open https://one.example");

    expect(["Browser Test's browser doesn't open https://one.example", "Fixture App's browser doesn't open https://one.example", "This browser doesn't open https://one.example"]
      .map(t => saying.test(t))).toEqual([true, false, false]);
  });

  it("takes the text's own characters literally, and refuses the module's bare name", () => {
    const saying = AppBrowser.saying("opens only addresses that start with http: or https:.");

    expect(["Browser Test's browser opens only addresses that start with http: or https:!", "Browser opens only addresses that start with http: or https:."].map(t => saying.test(t)))
      .toEqual([false, false]);
  });
});
