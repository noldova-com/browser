/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { ToolFailure, ToolFailureCode, WebViewFailureException } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { CallRefusedException } from "../../src/exceptions/call-refused.exception.ts";

const relayed: WebViewFailureException = new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Crashed));

describe("CallRefusedException", () => {
  it("keeps its facts and its message", () => {
    const exception: CallRefusedException = new CallRefusedException(relayed);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("CallRefusedException");
    expect(exception.message).toBe("The module made a call Noldova Desktop refused.");
    expect(exception.cause).toBe(relayed);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The module made a call Noldova Desktop refused.", "browser.internal"));
  });
});
