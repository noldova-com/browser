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
import { NotSubmittedException } from "../../src/exceptions/not-submitted.exception.ts";

describe("NotSubmittedException", () => {
  it("keeps its facts and its message", () => {
    const exception: NotSubmittedException = new NotSubmittedException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("NotSubmittedException");
    expect(exception.message).toBe("The text was typed, but the page gave its form a secret field, so it wasn't submitted; call it again with submit to ask at high risk.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale, "The text was typed, but the page gave its form a secret field, so it wasn't submitted; call it again with submit to ask at high risk.", "browser.notSubmitted"));
  });
});
