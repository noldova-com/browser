/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { CutText } from "../../src/models/cut-text.ts";

describe("CutText", () => {
  it("keeps its fields", () => {
    const cutText: CutText = new CutText("Sign in", true);

    expect([cutText.text, cutText.isCut]).toEqual(["Sign in", true]);
  });
});
