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
import { InternalFailureException } from "../../src/exceptions/internal-failure.exception.ts";

const cause: Error = new Error("inner");

describe("InternalFailureException", () => {
  it("keeps its facts and its message", () => {
    const exception: InternalFailureException = new InternalFailureException(cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("InternalFailureException");
    expect(exception.message).toBe("The tool failed.");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The tool failed.", "browser.internal"));
  });
});
