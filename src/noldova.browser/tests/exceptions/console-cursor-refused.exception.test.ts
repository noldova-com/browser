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
import { ConsoleCursorRefusedException } from "../../src/exceptions/console-cursor-refused.exception.ts";

describe("ConsoleCursorRefusedException", () => {
  it("keeps its facts and its message", () => {
    const exception: ConsoleCursorRefusedException = new ConsoleCursorRefusedException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ConsoleCursorRefusedException");
    expect(exception.message).toBe("This session wasn't given that cursor; read without one to go on from where this session stopped.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "This session wasn't given that cursor; read without one to go on from where this session stopped.", "browser.staleCursor"));
  });
});
