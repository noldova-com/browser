/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { KeyShortcut } from "../../../src/app/models/key-shortcut.ts";

describe("KeyShortcut", () => {
  it("keeps the keys on other systems and on the Mac", () => {
    const shortcut: KeyShortcut = new KeyShortcut("Ctrl+F", "⌘F");

    expect([shortcut.other, shortcut.mac]).toEqual(["Ctrl+F", "⌘F"]);
  });
});
