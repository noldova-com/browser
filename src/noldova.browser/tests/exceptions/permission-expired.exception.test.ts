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
import { PermissionExpiredException } from "../../src/exceptions/permission-expired.exception.ts";

describe("PermissionExpiredException", () => {
  it("keeps its facts and its message", () => {
    const exception: PermissionExpiredException = new PermissionExpiredException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PermissionExpiredException");
    expect(exception.message).toBe("The request expired before the person answered.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Expired, "The request expired before the person answered.", null));
  });
});
