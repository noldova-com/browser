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
import { ToolsOffException } from "../../src/exceptions/tools-off.exception.ts";

describe("ToolsOffException", () => {
  it("keeps its facts and its message", () => {
    const exception: ToolsOffException = new ToolsOffException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ToolsOffException");
    expect(exception.message).toBe("The person turned the browser's tools off for agents in Settings.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The person turned the browser's tools off for agents in Settings.", "browser.toolsOff"));
  });
});
