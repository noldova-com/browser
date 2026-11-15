/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserMethods } from "../../src/models/browser-methods.ts";

describe("BrowserMethods", () => {
  it("names the typed-address and typed-redirect requests under the module's id, as Noldova Desktop routes a part's requests", () => {
    expect([BrowserMethods.allowTypedAddress, BrowserMethods.passTypedRedirect, BrowserMethods.endTypedRedirects])
      .toEqual(["browser.allowTypedAddress", "browser.passTypedRedirect", "browser.endTypedRedirects"]);
  });

  it("names the request that readies a page's new view under the module's id", () => {
    expect(BrowserMethods.readyPage).toBe("browser.readyPage");
  });

  it("names the page records', browsing data's and page stops' requests under the module's id", () => {
    expect([BrowserMethods.rememberPage, BrowserMethods.readPage, BrowserMethods.forgetPage, BrowserMethods.clearBrowsingData, BrowserMethods.readAppName,
      BrowserMethods.stopPage, BrowserMethods.readActivities, BrowserMethods.claimPage, BrowserMethods.holdPages, BrowserMethods.letGoPage])
      .toEqual(["browser.rememberPage", "browser.readPage", "browser.forgetPage", "browser.clearBrowsingData", "browser.readAppName", "browser.stopPage",
        "browser.readActivities", "browser.claimPage", "browser.holdPages", "browser.letGoPage"]);
  });

  it("names the request that draws or takes away a teammate's mark in a page itself under the module's id", () => {
  });
});
