/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { PageActivityEventMalformedException } from "../../../src/app/exceptions/page-activity-event-malformed.exception.ts";
import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";

describe("PageActivityEventMalformedException", () => {
  it("names itself and says the runtime part's activity event isn't one, as a malformed answer at the path it is given", () => {
    const error: PageActivityEventMalformedException = new PageActivityEventMalformedException("$.box.width");

    expect(error).toBeInstanceOf(RuntimeAnswerMalformedException);
    expect([error.name, error.message, error.path, error.cause]).toEqual(["PageActivityEventMalformedException", "The runtime part's activity event isn't one.", "$.box.width", undefined]);
  });

  it("keeps the failure it is given as its cause", () => {
    const cause: Error = new Error("$.box.width: Expected a string.");

    expect(new PageActivityEventMalformedException("$.box.width", new ExceptionOptions(cause)).cause).toBe(cause);
  });
});
