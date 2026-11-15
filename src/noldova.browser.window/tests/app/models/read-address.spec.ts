/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ReadAddress } from "../../../src/app/models/read-address.ts";

describe("ReadAddress", () => {
  it("is an allowed reading of its address", () => {
    const reading: ReadAddress = new ReadAddress("https://example.com/");

    expect([reading.kind, reading.url]).toEqual(["Allowed", "https://example.com/"]);
  });
});
