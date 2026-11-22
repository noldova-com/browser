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
import { ScreenshotChangedException } from "../../src/exceptions/screenshot-changed.exception.ts";

describe("ScreenshotChangedException", () => {
  it("keeps its facts and its message", () => {
    const exception: ScreenshotChangedException = new ScreenshotChangedException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ScreenshotChangedException");
    expect(exception.message).toBe("The page went to another document while it was captured, so no image was kept; take a new screenshot.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale, "The page went to another document while it was captured, so no image was kept; take a new screenshot.", null));
  });
});
