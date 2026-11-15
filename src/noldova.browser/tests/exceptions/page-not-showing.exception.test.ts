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
import { PageNotShowingException } from "../../src/exceptions/page-not-showing.exception.ts";

const cause: Error = new Error("inner");

describe("PageNotShowingException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageNotShowingException = new PageNotShowingException(cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageNotShowingException");
    expect(exception.message).toBe("The page isn't laid out, so nothing was pressed at that point; ask the person to show its tab.");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The page isn't laid out, so nothing was pressed at that point; ask the person to show its tab.", "browser.pageNotShowing"));
  });

  it("has no cause when given none", () => {
    expect(new PageNotShowingException().cause).toBeUndefined();
  });
});
