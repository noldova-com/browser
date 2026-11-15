/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";
import { TypedAddressAnswerMalformedException } from "../../../src/app/exceptions/typed-address-answer-malformed.exception.ts";

describe("TypedAddressAnswerMalformedException", () => {
  it("names itself and says the runtime part's answer for a typed address isn't one, as a malformed answer at the path it is given", () => {
    const error: TypedAddressAnswerMalformedException = new TypedAddressAnswerMalformedException("$.origin");

    expect(error).toBeInstanceOf(RuntimeAnswerMalformedException);
    expect([error.name, error.message, error.path, error.cause]).toEqual(["TypedAddressAnswerMalformedException", "The runtime part's answer to a typed address isn't one.", "$.origin", undefined]);
  });

  it("keeps the failure it is given as its cause", () => {
    const cause: Error = new Error("$.origin: Expected a string.");

    expect(new TypedAddressAnswerMalformedException("$.origin", new ExceptionOptions(cause)).cause).toBe(cause);
  });
});
