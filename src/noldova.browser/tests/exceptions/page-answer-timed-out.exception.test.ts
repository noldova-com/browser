/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolAbortReason, ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { CallTimedOutException } from "../../src/exceptions/call-timed-out.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";

const cause: Error = new Error("inner");

describe("PageAnswerTimedOutException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageAnswerTimedOutException = new PageAnswerTimedOutException(cause);

    expect(exception).toBeInstanceOf(CallTimedOutException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageAnswerTimedOutException");
    expect(exception.message).toBe("The page didn't answer in time.");
    expect(exception.cause).toBe(cause);
    expect(exception.kind).toBe(ToolAbortReason.DeadlineReached);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.TimedOut, "The page didn't answer in time.", null));
  });

  it("has no cause when given none", () => {
    expect(new PageAnswerTimedOutException().cause).toBeUndefined();
  });
});
