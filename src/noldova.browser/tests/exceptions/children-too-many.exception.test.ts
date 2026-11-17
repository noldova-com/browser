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
import { CallTooLargeException } from "../../src/exceptions/call-too-large.exception.ts";
import { ChildrenTooManyException } from "../../src/exceptions/children-too-many.exception.ts";

const cause: Error = new Error("inner");
const MESSAGE: string = "A generic element on the page has 40000 children, more than one answer can carry, so the snapshot can't read past it.";

describe("ChildrenTooManyException", () => {
  it("keeps its facts and its message, which names the element by its role and its children's count", () => {
    const exception: ChildrenTooManyException = new ChildrenTooManyException("generic", 40_000, cause);

    expect(exception).toBeInstanceOf(CallTooLargeException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ChildrenTooManyException");
    expect(exception.message).toBe(MESSAGE);
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.TooLarge, MESSAGE, null));
  });

  it("has no cause when given none", () => {
    expect(new ChildrenTooManyException("list", 2).cause).toBeUndefined();
  });
});
