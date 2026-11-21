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
import { FieldNotVisibleException } from "../../src/exceptions/field-not-visible.exception.ts";

describe("FieldNotVisibleException", () => {
  it("keeps its facts and its message", () => {
    const exception: FieldNotVisibleException = new FieldNotVisibleException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("FieldNotVisibleException");
    expect(exception.message).toBe("The field isn't laid out on the page, so nothing was typed; take a new snapshot.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The field isn't laid out on the page, so nothing was typed; take a new snapshot.", "browser.notVisible"));
  });
});
