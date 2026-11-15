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
import { CallInterruptedException } from "../../src/exceptions/call-interrupted.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";

const cause: Error = new Error("inner");

describe("CallStoppedException", () => {
  it("keeps its facts and its message", () => {
    const exception: CallStoppedException = new CallStoppedException(cause);

    expect(exception).toBeInstanceOf(CallInterruptedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("CallStoppedException");
    expect(exception.message).toBe("The call was stopped.");
    expect(exception.cause).toBe(cause);
    expect(exception.kind).toBe(ToolAbortReason.Stopped);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stopped, "The call was stopped.", null));
  });

  it("has no cause when given none", () => {
    expect(new CallStoppedException().cause).toBeUndefined();
  });
});
