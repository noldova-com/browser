/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolAbortReason, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { CallDeadlineReachedException } from "../../src/exceptions/call-deadline-reached.exception.ts";
import { CallInterruptedException } from "../../src/exceptions/call-interrupted.exception.ts";
import { CallTimedOutException } from "../../src/exceptions/call-timed-out.exception.ts";

const cause: Error = new Error("inner");

describe("CallTimedOutException", () => {
  it("gives its subclasses the timed-out reason and the deadline as its kind", () => {
    const exception: CallDeadlineReachedException = new CallDeadlineReachedException();

    expect(exception).toBeInstanceOf(CallTimedOutException);
    expect(exception).toBeInstanceOf(CallInterruptedException);
    expect([exception.reason, exception.kind, exception.moduleCode]).toEqual([ToolFailureCode.TimedOut, ToolAbortReason.DeadlineReached, null]);
  });

  it("keeps the cause its subclass gives", () => {
    expect(new CallDeadlineReachedException(cause).cause).toBe(cause);
  });
});
