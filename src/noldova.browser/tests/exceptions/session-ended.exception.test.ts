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
import { SessionEndedException } from "../../src/exceptions/session-ended.exception.ts";

const cause: Error = new Error("inner");

describe("SessionEndedException", () => {
  it("keeps its facts and its message", () => {
    const exception: SessionEndedException = new SessionEndedException(cause);

    expect(exception).toBeInstanceOf(CallInterruptedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("SessionEndedException");
    expect(exception.message).toBe("The session ended, so the call was cancelled.");
    expect(exception.cause).toBe(cause);
    expect(exception.kind).toBe(ToolAbortReason.SessionEnded);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Cancelled, "The session ended, so the call was cancelled.", null));
  });

  it("has no cause when given none", () => {
    expect(new SessionEndedException().cause).toBeUndefined();
  });
});
