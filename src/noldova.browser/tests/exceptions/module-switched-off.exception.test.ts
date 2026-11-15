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
import { ModuleSwitchedOffException } from "../../src/exceptions/module-switched-off.exception.ts";

const cause: Error = new Error("inner");

describe("ModuleSwitchedOffException", () => {
  it("keeps its facts and its message", () => {
    const exception: ModuleSwitchedOffException = new ModuleSwitchedOffException(cause);

    expect(exception).toBeInstanceOf(CallInterruptedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ModuleSwitchedOffException");
    expect(exception.message).toBe("The module was switched off, or its tools were withdrawn.");
    expect(exception.cause).toBe(cause);
    expect(exception.kind).toBe(ToolAbortReason.SwitchedOff);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The module was switched off, or its tools were withdrawn.", null));
  });

  it("has no cause when given none", () => {
    expect(new ModuleSwitchedOffException().cause).toBeUndefined();
  });
});
