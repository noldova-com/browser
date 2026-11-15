/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { ToolFailure, ToolFailureCode, WebViewFailureException } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { ViewsUnavailableException } from "../../src/exceptions/views-unavailable.exception.ts";

const relayed: WebViewFailureException = new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Crashed));

describe("ViewsUnavailableException", () => {
  it("keeps its facts and its message", () => {
    const exception: ViewsUnavailableException = new ViewsUnavailableException(relayed);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ViewsUnavailableException");
    expect(exception.message).toBe("The app's window can't reach the page now.");
    expect(exception.cause).toBe(relayed);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The app's window can't reach the page now.", "browser.viewsUnavailable"));
  });
});
