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
import { PageNotControlledException } from "../../src/exceptions/page-not-controlled.exception.ts";

describe("PageNotControlledException", () => {
  it("names the view and its cause's message, and keeps the cause", () => {
    const cause: Error = new Error("The web view call failed: Unavailable.");
    const exception: PageNotControlledException = new PageNotControlledException("view-1", cause);
    const message: string = "The page's view view-1 couldn't be kept drawing for the agent, so nothing was done: The web view call failed: Unavailable.";

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageNotControlledException");
    expect(exception.message).toBe(message);
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, message, "browser.notControlled"));
  });

  it("names a cause that isn't an error as text", () => {
    expect(new PageNotControlledException("view-2", "gone").message).toBe("The page's view view-2 couldn't be kept drawing for the agent, so nothing was done: gone");
  });
});
