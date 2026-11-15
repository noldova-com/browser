/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { PageClaimAnswerMalformedException } from "../../../src/app/exceptions/page-claim-answer-malformed.exception.ts";
import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";

describe("PageClaimAnswerMalformedException", () => {
  it("names itself and says the runtime part's answer for a page's claim isn't one, as a malformed answer at the path it is given", () => {
    const error: PageClaimAnswerMalformedException = new PageClaimAnswerMalformedException("$.record.url");

    expect(error).toBeInstanceOf(RuntimeAnswerMalformedException);
    expect([error.name, error.message, error.path, error.cause]).toEqual(["PageClaimAnswerMalformedException", "The runtime part's answer to a page's claim isn't one.", "$.record.url", undefined]);
  });

  it("keeps the failure it is given as its cause", () => {
    const cause: Error = new Error("$.record.url: Expected a string.");

    expect(new PageClaimAnswerMalformedException("$.record.url", new ExceptionOptions(cause)).cause).toBe(cause);
  });
});
