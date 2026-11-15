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
import { PageHiddenException } from "../../src/exceptions/page-hidden.exception.ts";

describe("PageHiddenException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageHiddenException = new PageHiddenException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageHiddenException");
    expect(exception.message).toBe("The page has no size even when laid out for the capture, so nothing was captured; ask the person to show its tab.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The page has no size even when laid out for the capture, so nothing was captured; ask the person to show its tab.", "browser.pageHidden"));
  });
});
