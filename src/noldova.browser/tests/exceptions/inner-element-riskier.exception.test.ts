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
import { InnerElementRiskierException } from "../../src/exceptions/inner-element-riskier.exception.ts";

describe("InnerElementRiskierException", () => {
  it("keeps its facts and its message", () => {
    const exception: InnerElementRiskierException = new InnerElementRiskierException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("InnerElementRiskierException");
    expect(exception.message).toBe("The click would land on an element inside this one that asks at high risk, such as a submit button of a form with a secret field, so nothing was pressed; click that element's own reference to ask at high risk.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The click would land on an element inside this one that asks at high risk, such as a submit button of a form with a secret field, so nothing was pressed; click that element's own reference to ask at high risk.", "browser.innerElementRiskier"));
  });
});
