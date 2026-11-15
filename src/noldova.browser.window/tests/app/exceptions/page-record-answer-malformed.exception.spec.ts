/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { PageRecordAnswerMalformedException } from "../../../src/app/exceptions/page-record-answer-malformed.exception.ts";
import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";

describe("PageRecordAnswerMalformedException", () => {
  it("names itself and says the runtime part's answer for a page's record isn't one, as a malformed answer at the path it is given", () => {
    const error: PageRecordAnswerMalformedException = new PageRecordAnswerMalformedException("$.url");

    expect(error).toBeInstanceOf(RuntimeAnswerMalformedException);
    expect([error.name, error.message, error.path, error.cause]).toEqual(["PageRecordAnswerMalformedException", "The runtime part's page record isn't one.", "$.url", undefined]);
  });

  it("keeps the failure it is given as its cause", () => {
    const cause: Error = new Error("$.url: Expected a string.");

    expect(new PageRecordAnswerMalformedException("$.url", new ExceptionOptions(cause)).cause).toBe(cause);
  });
});
