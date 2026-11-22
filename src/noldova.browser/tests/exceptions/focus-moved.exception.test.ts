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
import { FocusMovedException } from "../../src/exceptions/focus-moved.exception.ts";

describe("FocusMovedException", () => {
  it("keeps its facts and its message", () => {
    const exception: FocusMovedException = new FocusMovedException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("FocusMovedException");
    expect(exception.message).toBe("The page moved the focus out of this element when it was focused, so nothing was typed; take a new snapshot and type into the element that has the focus.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale, "The page moved the focus out of this element when it was focused, so nothing was typed; take a new snapshot and type into the element that has the focus.", "browser.focusMoved"));
  });
});
