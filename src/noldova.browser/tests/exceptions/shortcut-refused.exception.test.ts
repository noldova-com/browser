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
import { ShortcutRefusedException } from "../../src/exceptions/shortcut-refused.exception.ts";

const relayed: WebViewFailureException = new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Crashed));

describe("ShortcutRefusedException", () => {
  it("keeps its facts and its message", () => {
    const exception: ShortcutRefusedException = new ShortcutRefusedException(relayed);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ShortcutRefusedException");
    expect(exception.message).toBe("The key is one of the app's shortcuts, which a page never gets.");
    expect(exception.cause).toBe(relayed);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The key is one of the app's shortcuts, which a page never gets.", "browser.shortcutRefused"));
  });
});
