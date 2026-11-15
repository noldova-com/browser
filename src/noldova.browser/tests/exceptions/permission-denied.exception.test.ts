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
import { CallDeniedException } from "../../src/exceptions/call-denied.exception.ts";
import { PermissionDeniedException } from "../../src/exceptions/permission-denied.exception.ts";

describe("PermissionDeniedException", () => {
  it("keeps its facts and its message", () => {
    const exception: PermissionDeniedException = new PermissionDeniedException();

    expect(exception).toBeInstanceOf(CallDeniedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PermissionDeniedException");
    expect(exception.message).toBe("The person didn't allow it.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Denied, "The person didn't allow it.", null));
  });
});
