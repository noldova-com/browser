/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ShownElement } from "../../src/models/shown-element.ts";

describe("ShownElement", () => {
  it("keeps its fields", () => {
    const shownElement: ShownElement = new ShownElement("textbox", "Password", true);

    expect([shownElement.role, shownElement.name, shownElement.isSecret]).toEqual(["textbox", "Password", true]);
  });
});
