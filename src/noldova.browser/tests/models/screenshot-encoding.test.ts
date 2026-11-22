/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ScreenshotEncoding } from "../../src/models/screenshot-encoding.ts";

describe("ScreenshotEncoding", () => {
  it("keeps its fields", () => {
    const encoding: ScreenshotEncoding = new ScreenshotEncoding("jpeg", 80);

    expect([encoding.format, encoding.quality]).toEqual(["jpeg", 80]);
  });
});
