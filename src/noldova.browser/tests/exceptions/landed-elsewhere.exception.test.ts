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
import { LandedElsewhereException } from "../../src/exceptions/landed-elsewhere.exception.ts";

describe("LandedElsewhereException", () => {
  it("keeps its facts and its message", () => {
    const exception: LandedElsewhereException = new LandedElsewhereException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("LandedElsewhereException");
    expect(exception.message).toBe("The page moved between the allow and the navigation, so it may have left or reached a page the request didn't name; check where it is before you act on it.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale,
      "The page moved between the allow and the navigation, so it may have left or reached a page the request didn't name; check where it is before you act on it.", "browser.landedElsewhere"));
  });
});
