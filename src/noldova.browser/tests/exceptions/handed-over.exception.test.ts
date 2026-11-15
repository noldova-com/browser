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
import { HandedOverException } from "../../src/exceptions/handed-over.exception.ts";

describe("HandedOverException", () => {
  it("keeps its facts and its message", () => {
    const exception: HandedOverException = new HandedOverException();

    expect(exception).toBeInstanceOf(CallDeniedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("HandedOverException");
    expect(exception.message).toBe("The person is doing it themself; the page is theirs, focused on the element.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Denied, "The person is doing it themself; the page is theirs, focused on the element.", "browser.handedOver"));
  });
});
