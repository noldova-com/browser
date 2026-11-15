/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { KeyPress } from "../../src/models/key-press.ts";

describe("KeyPress", () => {
  it("keeps its fields", () => {
    const press: KeyPress = new KeyPress({ type: "rawKeyDown", key: "Tab" }, { type: "keyUp", key: "Tab" });

    expect([press.down, press.up]).toEqual([{ type: "rawKeyDown", key: "Tab" }, { type: "keyUp", key: "Tab" }]);
  });
});
