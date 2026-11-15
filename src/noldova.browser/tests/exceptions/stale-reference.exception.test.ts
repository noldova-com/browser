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
import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";

const cause: Error = new Error("inner");

describe("StaleReferenceException", () => {
  it("keeps its facts and its message", () => {
    const exception: StaleReferenceException = new StaleReferenceException(cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("StaleReferenceException");
    expect(exception.message).toBe("The element reference is stale; take a new snapshot.");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The element reference is stale; take a new snapshot.", "browser.staleReference"));
  });

  it("has no cause when given none", () => {
    expect(new StaleReferenceException().cause).toBeUndefined();
  });
});
