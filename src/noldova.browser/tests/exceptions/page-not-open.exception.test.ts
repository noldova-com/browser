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
import { PageNotOpenException } from "../../src/exceptions/page-not-open.exception.ts";

describe("PageNotOpenException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageNotOpenException = new PageNotOpenException("5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f");

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageNotOpenException");
    expect(exception.message).toBe("The session's page isn't open; ask the person to open it again.");
    expect(exception.instance).toEqual("5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The session's page isn't open; ask the person to open it again.", "browser.viewClosed"));
  });
});
