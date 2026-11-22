/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MissingPartError } from "./missing-part.error.ts";

describe("MissingPartError", () => {
  it("names itself and the part the test lacks", () => {
    const error: MissingPartError = new MissingPartError("button");

    expect(error).toBeInstanceOf(Error);
    expect([error.name, error.message]).toEqual(["MissingPartError", "The test has no button."]);
  });
});
