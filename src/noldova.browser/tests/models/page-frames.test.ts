/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageFrames } from "../../src/models/page-frames.ts";

describe("PageFrames", () => {
  it("keeps its fields", () => {
    const pageFrames: PageFrames = new PageFrames("https://shop.test", "F1", ["F2", "F3"]);

    expect([pageFrames.origin, pageFrames.mainId, pageFrames.childIds]).toEqual(["https://shop.test", "F1", ["F2", "F3"]]);
  });
});
