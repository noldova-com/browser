/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { CallDeniedException } from "../../src/exceptions/call-denied.exception.ts";
import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { PermissionDeniedException } from "../../src/exceptions/permission-denied.exception.ts";

describe("CallDeniedException", () => {
  it("gives its subclasses the denied reason", () => {
    const exception: PermissionDeniedException = new PermissionDeniedException();

    expect(exception).toBeInstanceOf(CallDeniedException);
    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception.reason).toBe(ToolFailureCode.Denied);
  });
});
