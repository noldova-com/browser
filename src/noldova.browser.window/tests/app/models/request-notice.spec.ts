/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { RequestNotice } from "../../../src/app/models/request-notice.ts";

describe("RequestNotice", () => {
  it("keeps its glyph, its message and its action", () => {
    const notice: RequestNotice = new RequestNotice("block", "The page wanted to download a file.", null);

    expect([notice.glyph, notice.message, notice.action]).toEqual(["block", "The page wanted to download a file.", null]);
  });
});
