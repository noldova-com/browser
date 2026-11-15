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
import { ReplyTooLargeException } from "../../src/exceptions/reply-too-large.exception.ts";

const cause: Error = new Error("inner");

describe("ReplyTooLargeException", () => {
  it("keeps its facts and its message", () => {
    const exception: ReplyTooLargeException = new ReplyTooLargeException(cause);

    expect(exception).toBeInstanceOf(CallTooLargeException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ReplyTooLargeException");
    expect(exception.message).toBe("The page's answer is larger than the limit.");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.TooLarge, "The page's answer is larger than the limit.", null));
  });

  it("has no cause when given none", () => {
    expect(new ReplyTooLargeException().cause).toBeUndefined();
  });
});
