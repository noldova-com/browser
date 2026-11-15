/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRefusal } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("Resources", () => {
  it("says a second once, and any other time in seconds", () => {
    expect([Resources.formatSeconds(1_000), Resources.formatSeconds(30_000), Resources.formatSeconds(500)]).toEqual(["a second", "30 seconds", "0.5 seconds"]);
  });

  it("builds the laid-out screenshot's note and the wait's description from their limits", () => {
    expect(Resources.formatScreenshotLaidOut(2_000, 1024, 768)).toBe(
      "The page didn't draw within 2 seconds, as when its tab is hidden, so it was laid out at 1024 by 768 for this capture; its own size may differ.");
    expect(Resources.formatWaitForDescription(1_000)).toBe(
      "Waits until a text or an element appears, or the page has loaded, for at most a second. At the deadline it returns what it has found so far.");
  });

  it("gives the note and the description at the module's own limits", () => {
    expect([Resources.screenshotLaidOut, Resources.waitForDescription]).toEqual([
      "The page didn't draw within a second, as when its tab is hidden, so it was laid out at 1280 by 800 for this capture; its own size may differ.",
      "Waits until a text or an element appears, or the page has loaded, for at most 30 seconds. At the deadline it returns what it has found so far."
    ]);
  });

  it("counts a console read and adds each note that applies to it, in order", () => {
    expect([Resources.formatConsoleRead(1, 4, false, false, false), Resources.formatConsoleRead(2, 9, true, true, true)]).toEqual([
      "1 console entry; the next cursor is 4.",
      "2 console entries; the next cursor is 9. Older entries were dropped from the buffer before they were read. The console started again, so these may repeat entries an earlier read gave. More entries wait; read again with cursor 9."
    ]);
  });

  it("names a refused navigation's origin, or the address when it has none", () => {
    expect([Resources.formatRefused("https://shop.test"), Resources.formatRefused(null)]).toEqual(["Navigation to https://shop.test was refused.", "Navigation to the address was refused."]);
  });

  it("titles a click by the element's tag, in lower case, or as an element's when it has none", () => {
    expect([Resources.formatClickTitle("BUTTON"), Resources.formatClickTitle("")]).toEqual(["Click <button>", "Click an element"]);
  });

  it("says why a typed address is refused, for each refusal", () => {
    expect(Object.values(TypedAddressRefusal).map(t => Resources.formatAddressRefused(t))).toEqual([
      "The text isn't a web address, so the browser never opens it.",
      "The address isn't an http or https address, so the browser never opens it.",
      "The address is longer than the browser opens, so it never opens it.",
      "The address carries a user name or password, so the browser never opens it.",
      "The address is on this computer or its network, which the browser opens only once the person names its origin in Settings, under Sites on this computer or network (browser.localSites); ask them to, or use another address.",
      "The address is a link-local or unspecified one, which the browser never opens."
    ]);
  });
});
