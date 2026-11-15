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
import { TakenOverException } from "../../src/exceptions/taken-over.exception.ts";

describe("TakenOverException", () => {
  it("keeps its facts and its message", () => {
    const exception: TakenOverException = new TakenOverException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("TakenOverException");
    expect(exception.message).toBe("The person took this page over; this session can't act on it again.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The person took this page over; this session can't act on it again.", "browser.takenOver"));
  });
});
