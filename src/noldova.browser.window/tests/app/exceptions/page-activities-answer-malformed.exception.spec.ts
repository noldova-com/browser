/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { PageActivitiesAnswerMalformedException } from "../../../src/app/exceptions/page-activities-answer-malformed.exception.ts";
import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";

describe("PageActivitiesAnswerMalformedException", () => {
  it("names itself and says the runtime part's answer for the pages' activities isn't one, as a malformed answer at the path it is given", () => {
    const error: PageActivitiesAnswerMalformedException = new PageActivitiesAnswerMalformedException("$.1.state");

    expect(error).toBeInstanceOf(RuntimeAnswerMalformedException);
    expect([error.name, error.message, error.path, error.cause]).toEqual(["PageActivitiesAnswerMalformedException", "The runtime part's answer to the pages' activities isn't one.", "$.1.state", undefined]);
  });

  it("keeps the failure it is given as its cause", () => {
    const cause: Error = new Error("$.1.state: Expected a string.");

    expect(new PageActivitiesAnswerMalformedException("$.1.state", new ExceptionOptions(cause)).cause).toBe(cause);
  });
});
