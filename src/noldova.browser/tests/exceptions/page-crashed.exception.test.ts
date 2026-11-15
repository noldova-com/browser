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
import { PageCrashedException } from "../../src/exceptions/page-crashed.exception.ts";

const relayed: WebViewFailureException = new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Crashed));

describe("PageCrashedException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageCrashedException = new PageCrashedException(relayed);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageCrashedException");
    expect(exception.message).toBe("The page crashed; reload the pane.");
    expect(exception.cause).toBe(relayed);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The page crashed; reload the pane.", "browser.pageCrashed"));
  });
});
