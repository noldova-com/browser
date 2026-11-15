/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ZoomStep } from "../../../src/app/enums/zoom-step.ts";
import { PageKeys } from "../../../src/app/services/page-keys.ts";

describe("PageKeys", () => {
  function press(init: KeyboardEventInit): KeyboardEvent {
    return new KeyboardEvent("keydown", init);
  }

  it("declares reload on Ctrl+R and F5, and Cmd+R alone on macOS, a new page on Ctrl+T, and the address field on Ctrl+L, Cmd on macOS, as webViews.json does", () => {
    expect(PageKeys.all.map(t => t.toJson())).toEqual([
      { name: "reload", keys: ["Mod+R", "F5"], macKeys: ["Mod+R"] },
      { name: "newPage", keys: ["Mod+T"], macKeys: ["Mod+T"] },
      { name: "focusAddress", keys: ["Mod+L"], macKeys: ["Mod+L"] }
    ]);
  });

  it("names Noldova Desktop's platform from the browser's, Linux for any it doesn't know", () => {
    expect(["MacIntel", "Win32", "Linux x86_64", ""].map(t => PageKeys.platformOf(t))).toEqual(["darwin", "win32", "linux", "linux"]);
  });

  it("shows Noldova Desktop's zoom keys with Cmd on macOS and Ctrl elsewhere", () => {
    expect(["darwin", "win32", "linux"].map(t => PageKeys.zoomKeysOf(t))).toEqual([
      { [ZoomStep.In]: "⌘=", [ZoomStep.Out]: "⌘-", [ZoomStep.Reset]: "⌘0" },
      { [ZoomStep.In]: "Ctrl+=", [ZoomStep.Out]: "Ctrl+-", [ZoomStep.Reset]: "Ctrl+0" },
      { [ZoomStep.In]: "Ctrl+=", [ZoomStep.Out]: "Ctrl+-", [ZoomStep.Reset]: "Ctrl+0" }
    ]);
  });

  it("finds the key a press is on each platform, and none for another press", () => {
    expect([
      PageKeys.find(press({ key: "r", code: "KeyR", ctrlKey: true }), "win32"),
      PageKeys.find(press({ key: "F5", code: "F5" }), "linux"),
      PageKeys.find(press({ key: "r", code: "KeyR", metaKey: true }), "darwin"),
      PageKeys.find(press({ key: "t", code: "KeyT", ctrlKey: true }), "linux"),
      PageKeys.find(press({ key: "t", code: "KeyT", metaKey: true }), "darwin"),
      PageKeys.find(press({ key: "l", code: "KeyL", ctrlKey: true }), "win32"),
      PageKeys.find(press({ key: "F5", code: "F5" }), "darwin"),
      PageKeys.find(press({ key: "r", code: "KeyR" }), "win32")
    ]).toEqual(["reload", "reload", "reload", "newPage", "newPage", "focusAddress", null, null]);
  });
});
