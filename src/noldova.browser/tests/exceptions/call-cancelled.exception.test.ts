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
import { CallCancelledException } from "../../src/exceptions/call-cancelled.exception.ts";
import { CallInterruptedException } from "../../src/exceptions/call-interrupted.exception.ts";

const cause: Error = new Error("inner");

describe("CallCancelledException", () => {
  it("keeps its facts and its message", () => {
    const exception: CallCancelledException = new CallCancelledException(cause);

    expect(exception).toBeInstanceOf(CallInterruptedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("CallCancelledException");
    expect(exception.message).toBe("The call was cancelled.");
    expect(exception.cause).toBe(cause);
    expect(exception.kind).toBe(ToolAbortReason.Cancelled);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Cancelled, "The call was cancelled.", null));
  });

  it("has no cause when given none", () => {
    expect(new CallCancelledException().cause).toBeUndefined();
  });
});
