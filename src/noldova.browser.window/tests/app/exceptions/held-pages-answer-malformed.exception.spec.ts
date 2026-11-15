/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { HeldPagesAnswerMalformedException } from "../../../src/app/exceptions/held-pages-answer-malformed.exception.ts";
import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";

describe("HeldPagesAnswerMalformedException", () => {
  it("names itself and says the runtime part's answer for the window's open pages isn't one, as a malformed answer at the path it is given", () => {
    const error: HeldPagesAnswerMalformedException = new HeldPagesAnswerMalformedException("$.agents.0.agentName");

    expect(error).toBeInstanceOf(RuntimeAnswerMalformedException);
    expect([error.name, error.message, error.path, error.cause]).toEqual(["HeldPagesAnswerMalformedException", "The runtime part's answer to the window's open pages isn't one.", "$.agents.0.agentName", undefined]);
  });

  it("keeps the failure it is given as its cause", () => {
    const cause: Error = new Error("$.agents.0.agentName: Expected a string.");

    expect(new HeldPagesAnswerMalformedException("$.agents.0.agentName", new ExceptionOptions(cause)).cause).toBe(cause);
  });
});
