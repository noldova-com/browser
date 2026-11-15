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
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";
import { ScreenshotTargetException } from "../../src/exceptions/screenshot-target.exception.ts";

describe("ScreenshotTargetException", () => {
  it("keeps its facts and its message", () => {
    const exception: ScreenshotTargetException = new ScreenshotTargetException();

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ScreenshotTargetException");
    expect(exception.message).toBe("Give a reference or fullPage, not both.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "Give a reference or fullPage, not both.", null));
  });
});
