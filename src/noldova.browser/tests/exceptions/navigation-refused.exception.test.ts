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
import { NavigationRefusedException } from "../../src/exceptions/navigation-refused.exception.ts";

describe("NavigationRefusedException", () => {
  it("keeps its facts and its message", () => {
    const exception: NavigationRefusedException = new NavigationRefusedException("https://example.test");

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("NavigationRefusedException");
    expect(exception.message).toBe("Navigation to https://example.test was refused.");
    expect(exception.origin).toEqual("https://example.test");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "Navigation to https://example.test was refused.", null));
  });

  it("names no origin when it has none", () => {
    const exception: NavigationRefusedException = new NavigationRefusedException(null);

    expect([exception.message, exception.origin]).toEqual(["Navigation to the address was refused.", null]);
  });
});
