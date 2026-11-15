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
import { CallDeadlineReachedException } from "../../src/exceptions/call-deadline-reached.exception.ts";
import { CallTimedOutException } from "../../src/exceptions/call-timed-out.exception.ts";

const cause: Error = new Error("inner");

describe("CallDeadlineReachedException", () => {
  it("keeps its facts and its message", () => {
    const exception: CallDeadlineReachedException = new CallDeadlineReachedException(cause);

    expect(exception).toBeInstanceOf(CallTimedOutException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("CallDeadlineReachedException");
    expect(exception.message).toBe("The call reached its deadline.");
    expect(exception.cause).toBe(cause);
    expect(exception.kind).toBe(ToolAbortReason.DeadlineReached);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.TimedOut, "The call reached its deadline.", null));
  });

  it("has no cause when given none", () => {
    expect(new CallDeadlineReachedException().cause).toBeUndefined();
  });
});
