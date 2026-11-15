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
import { ElementCoveredException } from "../../src/exceptions/element-covered.exception.ts";

describe("ElementCoveredException", () => {
  it("keeps its facts and its message", () => {
    const exception: ElementCoveredException = new ElementCoveredException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ElementCoveredException");
    expect(exception.message).toBe("Another element covers the element at its centre, so nothing was clicked; take a new snapshot.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "Another element covers the element at its centre, so nothing was clicked; take a new snapshot.", "browser.covered"));
  });
});
