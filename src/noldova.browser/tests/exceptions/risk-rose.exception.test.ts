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
import { RiskRoseException } from "../../src/exceptions/risk-rose.exception.ts";

describe("RiskRoseException", () => {
  it("keeps its facts and its message", () => {
    const exception: RiskRoseException = new RiskRoseException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("RiskRoseException");
    expect(exception.message).toBe("The page made this element secret, or gave its form a secret field, after the action was allowed, so it wasn't done; call it again to ask at high risk.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale, "The page made this element secret, or gave its form a secret field, after the action was allowed, so it wasn't done; call it again to ask at high risk.", "browser.riskRose"));
  });
});
