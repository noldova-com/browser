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
import { PageUnboundException } from "../../src/exceptions/page-unbound.exception.ts";

describe("PageUnboundException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageUnboundException = new PageUnboundException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageUnboundException");
    expect(exception.message).toBe("The app bound this session to no page of its workspace.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Unavailable, "The app bound this session to no page of its workspace.", "browser.unbound"));
  });
});
