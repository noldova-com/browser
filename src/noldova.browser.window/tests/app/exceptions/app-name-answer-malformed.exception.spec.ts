/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { AppNameAnswerMalformedException } from "../../../src/app/exceptions/app-name-answer-malformed.exception.ts";
import { RuntimeAnswerMalformedException } from "../../../src/app/exceptions/runtime-answer-malformed.exception.ts";

describe("AppNameAnswerMalformedException", () => {
  it("names itself and says the runtime part's answer for the app's name isn't one, as a malformed answer at the path it is given", () => {
    const error: AppNameAnswerMalformedException = new AppNameAnswerMalformedException("$");

    expect(error).toBeInstanceOf(RuntimeAnswerMalformedException);
    expect([error.name, error.message, error.path, error.cause]).toEqual(["AppNameAnswerMalformedException", "The runtime part's app name isn't one.", "$", undefined]);
  });

  it("keeps the failure it is given as its cause", () => {
    const cause: Error = new Error("$: Expected a string.");

    expect(new AppNameAnswerMalformedException("$", new ExceptionOptions(cause)).cause).toBe(cause);
  });
});
