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
import { InternalFailureException } from "../../src/exceptions/internal-failure.exception.ts";
import { ToolsOffException } from "../../src/exceptions/tools-off.exception.ts";
import { UrlInvalidException } from "../../src/exceptions/url-invalid.exception.ts";

const cause: Error = new Error("inner");

describe("CallFailureException", () => {
  it("is a BrowserRuntimeException that keeps the cause its subclass gives", () => {
    const exception: InternalFailureException = new InternalFailureException(cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.cause).toBe(cause);
  });

  it("turns into a tool failure of its reason, its message and its module code", () => {
    const exception: ToolsOffException = new ToolsOffException();

    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The person turned the browser's tools off for agents in Settings.", "browser.toolsOff"));
  });

  it("turns into a tool failure without a module code when it has none", () => {
    const exception: UrlInvalidException = new UrlInvalidException();

    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The URL isn't valid.", null));
  });
});
