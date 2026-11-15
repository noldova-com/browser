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
import { NoHistoryException } from "../../src/exceptions/no-history.exception.ts";

describe("NoHistoryException", () => {
  it("keeps its facts and its message", () => {
    const exception: NoHistoryException = new NoHistoryException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("NoHistoryException");
    expect(exception.message).toBe("There is no page to go to.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "There is no page to go to.", "browser.noHistory"));
  });
});
