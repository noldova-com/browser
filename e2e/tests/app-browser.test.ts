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
  it("matches the text with the app's browser or this browser before it", () => {
    const saying = AppBrowser.saying("doesn't open https://one.example");

    expect(["Fixture App's browser doesn't open https://one.example", "This browser doesn't open https://one.example"].map(t => saying.test(t))).toEqual([true, true]);
  });

  it("takes the text's own characters literally, and refuses the module's bare name", () => {
    const saying = AppBrowser.saying("opens only addresses that start with http: or https:.");

    expect(["This browser opens only addresses that start with http: or https:!", "Browser opens only addresses that start with http: or https:."].map(t => saying.test(t)))
      .toEqual([false, false]);
  });
});
