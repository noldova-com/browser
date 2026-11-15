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
import { CallTooLargeException } from "../../src/exceptions/call-too-large.exception.ts";
import { ResultTooLargeException } from "../../src/exceptions/result-too-large.exception.ts";

describe("ResultTooLargeException", () => {
  it("keeps its facts and its message", () => {
    const exception: ResultTooLargeException = new ResultTooLargeException();

    expect(exception).toBeInstanceOf(CallTooLargeException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ResultTooLargeException");
    expect(exception.message).toBe("The result is larger than the limit.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.TooLarge, "The result is larger than the limit.", null));
  });
});
