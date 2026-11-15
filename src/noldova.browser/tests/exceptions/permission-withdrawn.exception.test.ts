/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { PermissionWithdrawnException } from "../../src/exceptions/permission-withdrawn.exception.ts";

const cause: Error = new Error("inner");

describe("PermissionWithdrawnException", () => {
  it("keeps its facts and its message", () => {
    const exception: PermissionWithdrawnException = new PermissionWithdrawnException(cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PermissionWithdrawnException");
    expect(exception.message).toBe("The request was withdrawn.");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Withdrawn, "The request was withdrawn.", null));
  });

  it("has no cause when given none", () => {
    expect(new PermissionWithdrawnException().cause).toBeUndefined();
  });
});
