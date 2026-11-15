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
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";

describe("MalformedReplyException", () => {
  it("keeps its facts and its message", () => {
    const exception: MalformedReplyException = new MalformedReplyException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("MalformedReplyException");
    expect(exception.message).toBe("The page's answer didn't have the expected shape.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The page's answer didn't have the expected shape.", "browser.malformedReply"));
  });
});
