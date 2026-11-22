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
import { PageLoadingException } from "../../src/exceptions/page-loading.exception.ts";

describe("PageLoadingException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageLoadingException = new PageLoadingException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageLoadingException");
    expect(exception.message).toBe("The page is still loading its next page, so nothing was done; wait for it with browser_wait_for, then try again.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable,
      "The page is still loading its next page, so nothing was done; wait for it with browser_wait_for, then try again.", "browser.pageLoading"));
  });
});
