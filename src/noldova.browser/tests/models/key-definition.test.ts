/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { KeyDefinition } from "../../src/models/key-definition.ts";

describe("KeyDefinition", () => {
  it("keeps its fields", () => {
    const keyDefinition: KeyDefinition = new KeyDefinition("Enter", "Enter", 13, "\r");

    expect([keyDefinition.key, keyDefinition.code, keyDefinition.keyCode, keyDefinition.text]).toEqual(["Enter", "Enter", 13, "\r"]);
  });
});
