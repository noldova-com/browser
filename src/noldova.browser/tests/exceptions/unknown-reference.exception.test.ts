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
import { UnknownReferenceException } from "../../src/exceptions/unknown-reference.exception.ts";

const cause: Error = new Error("inner");

describe("UnknownReferenceException", () => {
  it("keeps its facts and its message", () => {
    const exception: UnknownReferenceException = new UnknownReferenceException(cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("UnknownReferenceException");
    expect(exception.message).toBe("No snapshot gave this element reference; take a snapshot and use a reference from it.");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused,
      "No snapshot gave this element reference; take a snapshot and use a reference from it.", "browser.unknownReference"));
  });

  it("has no cause when given none", () => {
    expect(new UnknownReferenceException().cause).toBeUndefined();
  });
});
