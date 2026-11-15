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
import { ScreenshotNotVisibleException } from "../../src/exceptions/screenshot-not-visible.exception.ts";

describe("ScreenshotNotVisibleException", () => {
  it("keeps its facts and its message", () => {
    const exception: ScreenshotNotVisibleException = new ScreenshotNotVisibleException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ScreenshotNotVisibleException");
    expect(exception.message).toBe("The area has no size on the page, so nothing was captured; take a new snapshot.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The area has no size on the page, so nothing was captured; take a new snapshot.", "browser.notVisible"));
  });
});
