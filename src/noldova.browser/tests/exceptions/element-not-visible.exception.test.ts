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
import { ElementNotVisibleException } from "../../src/exceptions/element-not-visible.exception.ts";

describe("ElementNotVisibleException", () => {
  it("keeps its facts and its message", () => {
    const exception: ElementNotVisibleException = new ElementNotVisibleException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ElementNotVisibleException");
    expect(exception.message).toBe("The element has no box on the page, so it can't be clicked; take a new snapshot.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The element has no box on the page, so it can't be clicked; take a new snapshot.", "browser.notVisible"));
  });
});
