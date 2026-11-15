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
import { OutcomeUncertainException } from "../../src/exceptions/outcome-uncertain.exception.ts";

const cause: Error = new Error("inner");

describe("OutcomeUncertainException", () => {
  it("keeps its facts and its message", () => {
    const exception: OutcomeUncertainException = new OutcomeUncertainException("browser.staleReference", cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("OutcomeUncertainException");
    expect(exception.message).toBe("The action ended (browser.staleReference) after its input may have been sent; take a new snapshot to see the page.");
    expect(exception.endedCode).toEqual("browser.staleReference");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.OutcomeUncertain, "The action ended (browser.staleReference) after its input may have been sent; take a new snapshot to see the page.", null));
  });
});
